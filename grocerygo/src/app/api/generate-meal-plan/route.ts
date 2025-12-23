import { NextRequest, NextResponse } from 'next/server'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { mealPlanFromSurveyPrompt } from '@/app/meal-plan-generate/prompts'
import {
  createMealPlanContext,
  fetchUserSurveyResponse,
  getMealPlanForUser,
  fetchCandidateRecipesForMealType,
  getEmbedPrompts,
  fetchRecipeDetailsByIds
} from '@/services/mealPlanService'

interface MealSelection {
  breakfast: number
  lunch: number
  dinner: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mealSelection, mealPlanId, distinctRecipeCounts, selectedSlots } = body as {
      mealSelection: MealSelection
      mealPlanId: string
      distinctRecipeCounts?: MealSelection
      selectedSlots?: Array<{ day: string; mealType: string }>
    }

    const context = await createMealPlanContext()
    const mealPlan = await getMealPlanForUser(context, mealPlanId)

    if (!mealPlan) {
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 })
    }

    const surveyData =
      mealPlan.survey_snapshot || (await fetchUserSurveyResponse(context))

    if (!surveyData) {
      return NextResponse.json(
        { error: 'Please complete the onboarding survey first' },
        { status: 400 }
      )
    }

    // Calculate total meals
    const totalMeals = mealSelection.breakfast + mealSelection.lunch + mealSelection.dinner

    // Determine distinct recipe counts (fallback to no-duplicate scenario)
    const distinctCounts = distinctRecipeCounts
      ?? (mealPlan.survey_snapshot?.distinct_recipe_counts as MealSelection | undefined)
      ?? {
        breakfast: mealSelection.breakfast,
        lunch: mealSelection.lunch,
        dinner: mealSelection.dinner
      }

    const slots = (selectedSlots?.length ? selectedSlots : mealPlan.survey_snapshot?.selected_slots) as Array<{
      day: string
      mealType: string
    }> | undefined

    const toTitleCase = (value: string) =>
      value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()

    const resolvedSlots =
      slots && slots.length > 0
        ? slots.map((slot) => ({
            day: slot.day,
            mealType: toTitleCase(slot.mealType)
          }))
        : Array.from({ length: totalMeals }).map((_, index) => ({
            day: 'Unscheduled',
            mealType:
              index < mealSelection.breakfast
                ? 'Breakfast'
                : index < mealSelection.breakfast + mealSelection.lunch
                  ? 'Lunch'
                  : 'Dinner'
          }))

    const slotListText = resolvedSlots
      .map((slot, index) => {
        const label = `${slot.day} ${slot.mealType}`
        return `- Slot ${index + 1}: ${label}`
      })
      .join('\n')

    const surveyJson = surveyData ?? {}
    const favoredIngredients =
      Array.isArray((surveyJson as Record<string, unknown>)?.favored_ingredients)
        ? (surveyJson as Record<string, unknown>).favored_ingredients
        : []
    const excludedIngredients =
      Array.isArray((surveyJson as Record<string, unknown>)?.excluded_ingredients)
        ? (surveyJson as Record<string, unknown>).excluded_ingredients
        : []

    let ingredientPreferencesSection = ''
    if (
      Array.isArray(favoredIngredients) && favoredIngredients.length > 0 ||
      Array.isArray(excludedIngredients) && excludedIngredients.length > 0
    ) {
      ingredientPreferencesSection = '\n\n### Ingredient Preferences:\n'
      if (Array.isArray(favoredIngredients) && favoredIngredients.length > 0) {
        ingredientPreferencesSection += `**Favored Ingredients (prioritize using these):** ${favoredIngredients.join(', ')}\n`
      }
      if (Array.isArray(excludedIngredients) && excludedIngredients.length > 0) {
        ingredientPreferencesSection += `**Excluded Ingredients (NEVER use these):** ${excludedIngredients.join(', ')}\n`
      }
    }
    
    const EXCESS_MULTIPLIER = 3;
    
    // Generate all three embedding prompts in a single LLM call
    const embedPrompts = await getEmbedPrompts(surveyData);
    
    // Find breakfast, lunch, and dinner recipes using the generated prompts
    const [breakfastIDs, lunchIDs, dinnerIDs] = await Promise.all([
      fetchCandidateRecipesForMealType(embedPrompts.breakfast, context, 'breakfast', distinctCounts.breakfast * EXCESS_MULTIPLIER),
      fetchCandidateRecipesForMealType(embedPrompts.lunch, context, 'lunch/dinner', distinctCounts.lunch * EXCESS_MULTIPLIER),
      fetchCandidateRecipesForMealType(embedPrompts.dinner, context, 'lunch/dinner', distinctCounts.dinner * EXCESS_MULTIPLIER)
    ]);

    // Fetch full recipe details for each meal type
    const [breakfastRecipes, lunchRecipes, dinnerRecipes] = await Promise.all([
      fetchRecipeDetailsByIds(context, breakfastIDs),
      fetchRecipeDetailsByIds(context, lunchIDs),
      fetchRecipeDetailsByIds(context, dinnerIDs)
    ]);

    const enhancedPrompt = `${mealPlanFromSurveyPrompt}

### User Input:
${JSON.stringify(surveyData, null, 2)}
${ingredientPreferencesSection}

### candidate_recipes:
Breakfast recipes:
${JSON.stringify(breakfastRecipes, null, 2)}
Lunch/Dinner recipes:
${JSON.stringify(lunchRecipes, null, 2)}
Dinner recipes:
${JSON.stringify(dinnerRecipes, null, 2)}

### Meal Slots (authoritative: you MUST fill every one exactly once):
${slotListText}

## 🎯 SELECTION + SCHEDULING REQUIREMENTS (MANDATORY)

### Counts
- Total schedule slots: ${resolvedSlots.length}
- Total unique recipes to SELECT: ${
  distinctCounts.breakfast + distinctCounts.lunch + distinctCounts.dinner
}
- Total meals (schedule entries): ${totalMeals}

### Unique recipe targets (per mealType)
You MUST SELECT exactly:
- ${distinctCounts.breakfast} unique Breakfast recipe(s)
- ${distinctCounts.lunch} unique Lunch recipe(s)
- ${distinctCounts.dinner} unique Dinner recipe(s)

### Schedule breakdown (slot totals by mealType)
- ${mealSelection.breakfast} Breakfast slot(s)
- ${mealSelection.lunch} Lunch slot(s)
- ${mealSelection.dinner} Dinner slot(s)

### Critical selection rules
1) You MUST choose recipes ONLY from candidate_recipes. Do NOT invent recipes.
2) Do NOT select any candidate that violates exclusions/restrictions (excluded_ingredients, allergies Q7, dietary restrictions Q6).
3) Recipes may be reused across multiple slots by referencing the same recipeId in the schedule.
4) Prefer ingredient reuse across selected recipes, especially when cost efficiency is a priority.

### Servings + Portions rule (MANDATORY)
- Each schedule entry has a portionMultiplier (integer >= 1).
- For each recipeId, compute: totalPortionsAssigned = sum(portionMultiplier) across all schedule entries using that recipeId.
- Set recipes[].servings = totalPortionsAssigned for that recipe.
  (Example: if recipe-abc appears in 3 slots with multipliers 2,1,1 then servings must be 4)

### Required process (follow exactly)
1) Select the required number of UNIQUE recipes per mealType (ids) from candidate_recipes.
2) Build the schedule array so that EVERY slot listed above is mapped to one of the selected recipe IDs.
3) For each slot:
   - Use the correct day + mealType from the slot label
   - recipeId must be one of the selected recipes
   - portionMultiplier must be an integer >= 1 (default 1 unless user household needs more)
4) Clean the selected recipes:
   - Ensure every ingredient has a valid quantity + unit (per Measurement Units rules)
   - Steps must be 4–10 clear steps
   - Only small edits allowed (swap 1–3 ingredients, adjust quantities, minor simplifications) to meet preferences and ingredient reuse
5) Produce grocery_list with best-effort consolidated totals.
6) VALIDATE before returning (MANDATORY):
   - Unique recipe counts per mealType match the targets above.
   - schedule length equals ${resolvedSlots.length} and covers every slot exactly once.
   - Every schedule entry references a valid recipe ID.
   - Every recipe.servings equals the total portions assigned to that recipe across schedule.
   - Units comply (no "tbsp"; use "tbs" or "tb").
   - Protein requirement satisfied for every recipe when triggered.

### Output (JSON only, no explanation)
Return exactly the schema required above.`


    const result = streamText({
      model: openai('gpt-5'),
      system: `You are an expert meal planning assistant for GroceryGo.

      You must build meal plans by SELECTING recipes from the provided database candidates and then cleaning them up (units/steps/minor edits), creating a complete schedule, and producing a grocery list.

      CRITICAL RULES:
      - Do NOT invent recipes. Every recipe must come from candidate_recipes.
      - Fill every requested slot exactly once in the schedule.
      - Enforce the exact unique recipe counts per mealType provided by the user prompt.
      - recipes[].servings MUST equal the total portions assigned to that recipe across schedule (sum of portionMultiplier).
      - Follow measurement units strictly (NEVER "tbsp"; use "tbs" or "tb").
      - Return JSON only.

      PROCESS:
      1) Select: Pick the exact number of unique recipes per mealType from candidate_recipes.
      2) Schedule: Map every slot to a selected recipeId (reuse allowed).
      3) Set servings: For each recipe, set servings = sum of portionMultiplier in schedule for that recipeId.
      4) Clean: Normalize ingredients + units and produce 4–10 steps per recipe.
      5) Validate: Ensure counts, slot coverage, servings math, exclusions, and unit rules all pass.
      6) Output: Return only if validation passes.`,
      prompt: enhancedPrompt,
    })

    // Return the stream as a response
    return result.toTextStreamResponse()

  } catch (error: unknown) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate meal plan' },
      { status: 500 }
    )
  }
}


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
    const { mealSelection, mealPlanId, distinctRecipeCounts, selectedSlots, fetchCandidatesOnly } = body as {
      mealSelection: MealSelection
      mealPlanId: string
      distinctRecipeCounts?: MealSelection
      selectedSlots?: Array<{ day: string; mealType: string }>
      fetchCandidatesOnly?: boolean
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

    // Generate all three embedding prompts in a single LLM call
    const embedPrompts = await getEmbedPrompts(surveyData);
    
    // Find breakfast, lunch, and dinner recipes using the generated prompts
    const [breakfastIDs, lunchIDs, dinnerIDs] = await Promise.all([
      fetchCandidateRecipesForMealType(embedPrompts.breakfast, context, 'breakfast', distinctCounts.breakfast),
      fetchCandidateRecipesForMealType(embedPrompts.lunch, context, 'lunch/dinner', distinctCounts.lunch),
      fetchCandidateRecipesForMealType(embedPrompts.dinner, context, 'lunch/dinner', distinctCounts.dinner)
    ]);

    // Fetch full recipe details for each meal type
    const [breakfastRecipes, lunchRecipes, dinnerRecipes] = await Promise.all([
      fetchRecipeDetailsByIds(context, breakfastIDs),
      fetchRecipeDetailsByIds(context, lunchIDs),
      fetchRecipeDetailsByIds(context, dinnerIDs)
    ]);

    // If only fetching candidates, return them now
    if (fetchCandidatesOnly) {
      const allCandidates = [
        ...breakfastRecipes.map(r => ({ ...r, mealType: 'breakfast' })),
        ...lunchRecipes.map(r => ({ ...r, mealType: 'lunch' })),
        ...dinnerRecipes.map(r => ({ ...r, mealType: 'dinner' }))
      ]
      return NextResponse.json({ candidates: allCandidates })
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

    const enhancedPrompt = `${mealPlanFromSurveyPrompt}

### User Input:
${JSON.stringify(surveyData, null, 2)}
${ingredientPreferencesSection}

### provided_recipes:
You have been provided with exactly ONE recipe for each distinct meal type needed:
- ${distinctCounts.breakfast} Breakfast recipe(s):
${JSON.stringify(breakfastRecipes, null, 2)}
- ${distinctCounts.lunch} Lunch recipe(s):
${JSON.stringify(lunchRecipes, null, 2)}
- ${distinctCounts.dinner} Dinner recipe(s):
${JSON.stringify(dinnerRecipes, null, 2)}

### Meal Slots (authoritative: you MUST fill every one exactly once):
${slotListText}

## 🎯 MODIFICATION + SCHEDULING REQUIREMENTS (MANDATORY)

### Counts
- Total schedule slots: ${resolvedSlots.length}
- Total unique recipes to MODIFY and use: ${
  distinctCounts.breakfast + distinctCounts.lunch + distinctCounts.dinner
}
- Total meals (schedule entries): ${totalMeals}

### Recipe modification targets (per mealType)
You MUST MODIFY and use ALL provided recipes:
- ${distinctCounts.breakfast} Breakfast recipe(s) - modify each to align with user goals
- ${distinctCounts.lunch} Lunch recipe(s) - modify each to align with user goals
- ${distinctCounts.dinner} Dinner recipe(s) - modify each to align with user goals

### Schedule breakdown (slot totals by mealType)
- ${mealSelection.breakfast} Breakfast slot(s)
- ${mealSelection.lunch} Lunch slot(s)
- ${mealSelection.dinner} Dinner slot(s)

### Critical modification rules
1) You MUST modify ALL provided recipes to align with user goals. Do NOT use recipes as-is without modifications.
2) If a provided recipe violates exclusions/restrictions (excluded_ingredients, allergies Q7, dietary restrictions Q6), you MUST modify it to remove or replace those ingredients.
3) Recipes may be reused across multiple slots by referencing the same recipeId in the schedule (after modification).
4) When cost efficiency is a priority, MODIFY recipes to consolidate ingredients - use the same ingredients across multiple recipes to maximize reuse.

### Servings + Portions rule (MANDATORY)
- Each schedule entry has a portionMultiplier (integer >= 1).
- For each recipeId, compute: totalPortionsAssigned = sum(portionMultiplier) across all schedule entries using that recipeId.
- Set recipes[].servings = totalPortionsAssigned for that recipe.
  (Example: if recipe-abc appears in 3 slots with multipliers 2,1,1 then servings must be 4)

### Required process (follow exactly)
1) MODIFY each provided recipe to align with user goals:
   - For high protein goals: Add quality protein sources if missing
   - For cost efficiency: Consolidate ingredients across ALL recipes (use same ingredients in multiple recipes)
   - Remove/replace excluded ingredients
   - Adjust for dietary restrictions and allergies
   - Ensure ingredients have valid quantities + units
   - Ensure steps are clear (4–10 steps)
2) Build the schedule array so that EVERY slot listed above is mapped to one of the modified recipe IDs.
3) For each slot:
   - Use the correct day + mealType from the slot label
   - recipeId must reference one of the modified recipes
   - portionMultiplier must be an integer >= 1 (default 1 unless user household needs more)
4) Produce grocery_list with best-effort consolidated totals (this should be easier since you've consolidated ingredients across recipes).
5) VALIDATE before returning (MANDATORY):
   - ALL provided recipes are used and modified (one distinct modified recipe per provided recipe).
   - schedule length equals ${resolvedSlots.length} and covers every slot exactly once.
   - Every schedule entry references a valid recipe ID.
   - Every recipe.servings equals the total portions assigned to that recipe across schedule.
   - Units comply (no "tbsp"; use "tbs" or "tb").
   - Protein requirement satisfied for every recipe when triggered (recipes must be modified to include quality protein sources).
   - If cost efficiency is a priority: ingredients are consolidated across recipes (same ingredients used in multiple recipes).

### Output (JSON only, no explanation)
Return exactly the schema required above.`


    const result = streamText({
      model: openai('gpt-5'),
      system: `You are an expert meal planning assistant for GroceryGo.

      You must build meal plans by MODIFYING the provided recipes to align with user goals, then scheduling them and producing a grocery list.

      CRITICAL RULES:
      - Do NOT invent new recipes. Every recipe must be based on a provided_recipes entry, but you MUST modify them.
      - You MUST modify ALL provided recipes to align with user goals (protein requirements, cost efficiency via ingredient consolidation, etc.).
      - Fill every requested slot exactly once in the schedule.
      - recipes[].servings MUST equal the total portions assigned to that recipe across schedule (sum of portionMultiplier).
      - Follow measurement units strictly (NEVER "tbsp"; use "tbs" or "tb").
      - Return JSON only.

      PROCESS:
      1) Modify: Update each provided recipe to align with user goals (add protein if needed, consolidate ingredients for cost efficiency, remove excluded ingredients, etc.).
      2) Schedule: Map every slot to a modified recipeId (reuse allowed).
      3) Set servings: For each recipe, set servings = sum of portionMultiplier in schedule for that recipeId.
      4) Validate: Ensure all provided recipes are used, slot coverage, servings math, exclusions, unit rules, and goal alignment all pass.
      5) Output: Return only if validation passes.`,
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


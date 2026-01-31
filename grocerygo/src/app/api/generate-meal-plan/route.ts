import { NextRequest, NextResponse } from 'next/server'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { mealPlanFromSurveyPrompt } from '@/app/meal-plan-generate/prompts'
import { REGULAR_MODEL } from '@/config/aiModels'
import { logUnexpectedError, logValidationError, logApiError } from '@/utils/errorLogger'
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
  let mealPlanId: string | undefined
  let mealSelection: MealSelection | undefined
  let distinctRecipeCounts: MealSelection | undefined
  let selectedSlots: Array<{ day: string; mealType: string }> | undefined
  
  try {
    const body = await request.json()
    const parsed = body as {
      mealSelection: MealSelection
      mealPlanId: string
      distinctRecipeCounts?: MealSelection
      selectedSlots?: Array<{ day: string; mealType: string }>
      fetchCandidatesOnly?: boolean
    }

    const context = await createMealPlanContext()

    if (!parsed.mealSelection) {
      logValidationError('POST /api/generate-meal-plan', new Error('Meal selection not found'), {
        validationType: 'meal_selection_existence',
        field: 'mealSelection',
        input: parsed.mealSelection,
        reason: 'Meal selection not found'
      }, context.user.id)
      return NextResponse.json({ error: 'Meal selection not found' }, { status: 400 })
    }
    const validatedMealSelection = parsed.mealSelection
    mealPlanId = parsed.mealPlanId
    distinctRecipeCounts = parsed.distinctRecipeCounts
    selectedSlots = parsed.selectedSlots
    const fetchCandidatesOnly = parsed.fetchCandidatesOnly

    const mealPlan = await getMealPlanForUser(context, mealPlanId)

    if (!mealPlan) {
      logValidationError('POST /api/generate-meal-plan', new Error('Meal plan not found'), {
        validationType: 'meal_plan_existence',
        field: 'mealPlanId',
        input: mealPlanId,
        reason: 'Meal plan not found or does not belong to user'
      }, context.user.id)
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 })
    }

    const surveyData =
      mealPlan.survey_snapshot || (await fetchUserSurveyResponse(context))

    if (!surveyData) {
      logValidationError('POST /api/generate-meal-plan', new Error('Survey data not found'), {
        validationType: 'survey_completion',
        reason: 'User has not completed onboarding survey'
      }, context.user.id)
      return NextResponse.json(
        { error: 'Please complete the onboarding survey first' },
        { status: 400 }
      )
    }

    // Calculate total meals
    const totalMeals = validatedMealSelection.breakfast + validatedMealSelection.lunch + validatedMealSelection.dinner

    // Determine distinct recipe counts (fallback to no-duplicate scenario)
    const distinctCounts = distinctRecipeCounts
      ?? (mealPlan.survey_snapshot?.distinct_recipe_counts as MealSelection | undefined)
      ?? {
        breakfast: validatedMealSelection.breakfast,
        lunch: validatedMealSelection.lunch,
        dinner: validatedMealSelection.dinner
      }

    // Generate unique embedding prompts for each meal type based on distinct counts
    const embedPrompts = await getEmbedPrompts(surveyData, {
      breakfast: distinctCounts.breakfast,
      lunch: distinctCounts.lunch,
      dinner: distinctCounts.dinner
    }) as { breakfast: string[]; lunch: string[]; dinner: string[] };
    
    // Fetch one recipe per prompt for each meal type
    const breakfastIDs: string[] = [];
    const lunchIDs: string[] = [];
    const dinnerIDs: string[] = [];

    // Fetch breakfast recipes - one per prompt
    for (const prompt of embedPrompts.breakfast) {
      const ids = await fetchCandidateRecipesForMealType(prompt, context, 'breakfast', 1);
      breakfastIDs.push(...ids);
    }

    // Fetch lunch recipes - one per prompt
    for (const prompt of embedPrompts.lunch) {
      const ids = await fetchCandidateRecipesForMealType(prompt, context, 'lunch/dinner', 1);
      lunchIDs.push(...ids);
    }

    // Fetch dinner recipes - one per prompt
    for (const prompt of embedPrompts.dinner) {
      const ids = await fetchCandidateRecipesForMealType(prompt, context, 'lunch/dinner', 1);
      dinnerIDs.push(...ids);
    }

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
              index < validatedMealSelection.breakfast
                ? 'Breakfast'
                : index < validatedMealSelection.breakfast + validatedMealSelection.lunch
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
    // Use questions '12' (Foods You Like) and '13' (Foods You Dislike)
    // Fall back to old fields for backward compatibility
    const favoredIngredients =
      Array.isArray((surveyJson as Record<string, unknown>)?.['12'])
        ? (surveyJson as Record<string, unknown>)['12']
        : Array.isArray((surveyJson as Record<string, unknown>)?.favored_ingredients)
        ? (surveyJson as Record<string, unknown>).favored_ingredients
        : []
    const excludedIngredients =
      Array.isArray((surveyJson as Record<string, unknown>)?.['13'])
        ? (surveyJson as Record<string, unknown>)['13']
        : Array.isArray((surveyJson as Record<string, unknown>)?.excluded_ingredients)
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
- ${validatedMealSelection.breakfast} Breakfast slot(s)
- ${validatedMealSelection.lunch} Lunch slot(s)
- ${validatedMealSelection.dinner} Dinner slot(s)

### Critical modification rules
1) You MUST modify ALL provided recipes to align with user goals. Do NOT use recipes as-is without modifications.
2) If a provided recipe violates exclusions/restrictions (Question '13' - excluded ingredients, allergies Q7, dietary restrictions Q6), you MUST modify it to remove or replace those ingredients.
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
4) Standardize ingredient names across ALL recipes:
   - Use consistent names (e.g., always "eggs" not "egg", always "chicken breast" not variations)
   - Consolidate similar ingredients (e.g., "chicken breast", "boneless chicken breast" → use "chicken breast")
   - Use plural forms consistently for countable items
5) Produce grocery_list with consolidated totals:
   - Use the EXACT SAME ingredient names from recipes (no variations)
   - Sum quantities for the same ingredient (e.g., if Recipe 1 has "2 cups eggs" and Recipe 2 has "1 cup eggs", grocery list should have "3 cups eggs")
   - DO NOT create duplicate entries for the same ingredient
6) VALIDATE before returning (MANDATORY):
   - ALL provided recipes are used and modified (one distinct modified recipe per provided recipe).
   - schedule length equals ${resolvedSlots.length} and covers every slot exactly once.
   - Every schedule entry references a valid recipe ID.
   - Every recipe.servings equals the total portions assigned to that recipe across schedule.
   - Units comply (no "tbsp"; use "tbs" or "tb").
   - Protein requirement satisfied for every recipe when triggered (recipes must be modified to include quality protein sources).
   - If cost efficiency is a priority: ingredients are consolidated across recipes (same ingredients used in multiple recipes).
   - **INGREDIENT CONSOLIDATION: All recipes use consistent ingredient names, grocery list uses same names and consolidates quantities (no duplicates).**

### Output (JSON only, no explanation)
Return exactly the schema required above.`


    const result = streamText({
      model: openai(REGULAR_MODEL),
      system: `You are an expert meal planning assistant for GroceryGo.

      You must build meal plans by MODIFYING the provided recipes to align with user goals, then scheduling them and producing a grocery list.

      CRITICAL RULES:
      - Do NOT invent new recipes. Every recipe must be based on a provided_recipes entry, but you MUST modify them.
      - You MUST modify ALL provided recipes to align with user goals (protein requirements, cost efficiency via ingredient consolidation, etc.).
      - Fill every requested slot exactly once in the schedule.
      - recipes[].servings MUST equal the total portions assigned to that recipe across schedule (sum of portionMultiplier).
      - Follow measurement units strictly (NEVER "tbsp"; use "tbs" or "tb").
      - **INGREDIENT CONSOLIDATION IS MANDATORY**: Use consistent ingredient names across all recipes (e.g., always "eggs" not "egg", always "chicken breast" not variations). Grocery list must use the same names and consolidate quantities.
      - Return JSON only.

      PROCESS:
      1) Modify: Update each provided recipe to align with user goals (add protein if needed, consolidate ingredients for cost efficiency, remove excluded ingredients, etc.).
      2) Standardize: Ensure all recipes use consistent ingredient names (no variations like "egg" vs "eggs" or "chicken" vs "chicken breast").
      3) Schedule: Map every slot to a modified recipeId (reuse allowed).
      4) Set servings: For each recipe, set servings = sum of portionMultiplier in schedule for that recipeId.
      5) Consolidate grocery list: Use the same standardized ingredient names from recipes, sum quantities for the same ingredient, ensure no duplicate entries.
      6) Validate: Ensure all provided recipes are used, slot coverage, servings math, exclusions, unit rules, ingredient consolidation, and goal alignment all pass.
      7) Output: Return only if validation passes.`,
      prompt: enhancedPrompt,
    })

    // Return the stream as a response
    return result.toTextStreamResponse()

  } catch (error: unknown) {
    logUnexpectedError('POST /api/generate-meal-plan', error, {
      mealPlanId: mealPlanId || 'unknown',
      mealSelection: mealSelection || undefined,
      distinctRecipeCounts: distinctRecipeCounts || undefined,
      selectedSlots: selectedSlots || undefined
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate meal plan' },
      { status: 500 }
    )
  }
}


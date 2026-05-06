import { NextRequest, NextResponse } from 'next/server'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { mealPlanFromSurveyPrompt } from '@/app/meal-plan-generate/prompts'
import { REGULAR_MODEL } from '@/config/aiModels'
import { logUnexpectedError, logValidationError } from '@/utils/errorLogger'
import {
  createMealPlanContext,
  fetchUserSurveyResponse,
  getMealPlanForUser,
  fetchCandidateRecipesForMealType,
  getEmbedPrompts,
  fetchRecipeDetailsByIds,
  fetchSavedRecipeDetailsByIds
} from '@/services/mealPlanService'
import { assertWithinDailyAIQuota } from '@/app/actions/quota'
import { isQuotaError } from '@/lib/quota'
import {
  mergeSelectedSavedWithAICandidates,
  type SelectedSavedRecipeIds
} from './candidateMerge'
import {
  buildProvidedRecipesPromptSection,
  computeRemainingCounts,
  normalizeSelectedSavedRecipeIds
} from './promptContext'

interface MealSelection {
  breakfast: number
  lunch: number
  dinner: number
}

type DistinctCounts = MealSelection

/**
 * Map household size (Question 2) to servings per meal
 */
function getServingsPerMeal(householdSize: string | undefined): number {
  switch (householdSize) {
    case 'Just me': return 1
    case '2 people': return 2
    case '3-4 people': return 3
    case '5+ people': return 4
    default: return 1
  }
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
      selectedSavedRecipeIds?: SelectedSavedRecipeIds
      fetchCandidatesOnly?: boolean
    }

    const context = await createMealPlanContext()

    // Rate limit AI usage (server-controlled via Supabase RPC)
    try {
      await assertWithinDailyAIQuota(context.supabase)
    } catch (e) {
      if (isQuotaError(e)) {
        return NextResponse.json({ error: e.message }, { status: 429 })
      }
      throw e
    }

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

    const selectedSavedRecipeIds = parsed.selectedSavedRecipeIds
      ?? (mealPlan.survey_snapshot?.selected_saved_recipe_ids as SelectedSavedRecipeIds | undefined)
      ?? { breakfast: [], lunch: [], dinner: [] }

    const selectedSavedIdsByType = normalizeSelectedSavedRecipeIds({
      breakfast: selectedSavedRecipeIds.breakfast ?? [],
      lunch: selectedSavedRecipeIds.lunch ?? [],
      dinner: selectedSavedRecipeIds.dinner ?? []
    })

    const [selectedBreakfastRecipes, selectedLunchRecipes, selectedDinnerRecipes] = await Promise.all([
      fetchSavedRecipeDetailsByIds(context, selectedSavedIdsByType.breakfast),
      fetchSavedRecipeDetailsByIds(context, selectedSavedIdsByType.lunch),
      fetchSavedRecipeDetailsByIds(context, selectedSavedIdsByType.dinner)
    ])

    const validSelectedSavedIds: SelectedSavedRecipeIds = {
      breakfast: selectedBreakfastRecipes.map((recipe) => recipe.recipe_id),
      lunch: selectedLunchRecipes.map((recipe) => recipe.recipe_id),
      dinner: selectedDinnerRecipes.map((recipe) => recipe.recipe_id)
    }

    const remainingCounts: DistinctCounts = computeRemainingCounts(
      distinctCounts,
      validSelectedSavedIds
    )

    // Generate AI prompts only for remaining recipe counts
    const embedPrompts = await getEmbedPrompts(surveyData, {
      breakfast: remainingCounts.breakfast,
      lunch: remainingCounts.lunch,
      dinner: remainingCounts.dinner
    }) as { breakfast: string[]; lunch: string[]; dinner: string[] };
    
    // Fetch one recipe per prompt for each meal type
    const breakfastIDs: string[] = [];
    const lunchIDs: string[] = [];
    const dinnerIDs: string[] = [];

    // Fetch breakfast recipes - one per prompt
    for (const prompt of embedPrompts.breakfast.slice(0, remainingCounts.breakfast)) {
      const ids = await fetchCandidateRecipesForMealType(prompt, context, 'breakfast', 1);
      breakfastIDs.push(...ids);
    }

    // Fetch lunch recipes - one per prompt
    for (const prompt of embedPrompts.lunch.slice(0, remainingCounts.lunch)) {
      const ids = await fetchCandidateRecipesForMealType(prompt, context, 'lunch/dinner', 1);
      lunchIDs.push(...ids);
    }

    // Fetch dinner recipes - one per prompt
    for (const prompt of embedPrompts.dinner.slice(0, remainingCounts.dinner)) {
      const ids = await fetchCandidateRecipesForMealType(prompt, context, 'lunch/dinner', 1);
      dinnerIDs.push(...ids);
    }

    const aiCandidateIds = {
      breakfast: breakfastIDs,
      lunch: lunchIDs,
      dinner: dinnerIDs
    }

    const mergedCandidateIds = mergeSelectedSavedWithAICandidates({
      distinctCounts,
      selectedSavedRecipeIds: validSelectedSavedIds,
      aiCandidateIds
    })

    const aiOnlyIds = {
      breakfast: mergedCandidateIds.breakfast.filter((id) => !validSelectedSavedIds.breakfast.includes(id)),
      lunch: mergedCandidateIds.lunch.filter((id) => !validSelectedSavedIds.lunch.includes(id)),
      dinner: mergedCandidateIds.dinner.filter((id) => !validSelectedSavedIds.dinner.includes(id))
    }

    const [breakfastAIRecipes, lunchAIRecipes, dinnerAIRecipes] = await Promise.all([
      fetchRecipeDetailsByIds(context, aiOnlyIds.breakfast),
      fetchRecipeDetailsByIds(context, aiOnlyIds.lunch),
      fetchRecipeDetailsByIds(context, aiOnlyIds.dinner)
    ])

    const byId = <T extends { recipe_id: string }>(recipes: T[]) =>
      new Map(recipes.map((recipe) => [recipe.recipe_id, recipe]))

    const breakfastSavedMap = byId(selectedBreakfastRecipes)
    const lunchSavedMap = byId(selectedLunchRecipes)
    const dinnerSavedMap = byId(selectedDinnerRecipes)
    const breakfastAIMap = byId(breakfastAIRecipes)
    const lunchAIMap = byId(lunchAIRecipes)
    const dinnerAIMap = byId(dinnerAIRecipes)

    const assemble = (
      orderedIds: string[],
      savedMap: Map<string, Awaited<ReturnType<typeof fetchSavedRecipeDetailsByIds>>[number]>,
      aiMap: Map<string, Awaited<ReturnType<typeof fetchRecipeDetailsByIds>>[number]>
    ) =>
      orderedIds
        .map((id) => savedMap.get(id) ?? aiMap.get(id))
        .filter((recipe): recipe is NonNullable<typeof recipe> => recipe != null)

    const breakfastRecipes = assemble(mergedCandidateIds.breakfast, breakfastSavedMap, breakfastAIMap)
    const lunchRecipes = assemble(mergedCandidateIds.lunch, lunchSavedMap, lunchAIMap)
    const dinnerRecipes = assemble(mergedCandidateIds.dinner, dinnerSavedMap, dinnerAIMap)

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
    // Extract household size (Question 2)
    const householdSize = (surveyJson as Record<string, unknown>)?.['2'] as string | undefined
    const servingsPerMeal = getServingsPerMeal(householdSize)
    
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

    // Check if protein requirement applies
    const goals = (surveyJson as Record<string, unknown>)?.['9'] as string[] || []
    const priorities = (surveyJson as Record<string, unknown>)?.['11'] as string[] || []
    const requiresProtein = goals.includes('Eat healthier') || priorities[0] === 'Nutrition'

    const providedRecipesSection = buildProvidedRecipesPromptSection({
      distinctCounts,
      breakfastRecipes,
      lunchRecipes,
      dinnerRecipes,
      validSelectedSavedIds
    })

    const enhancedPrompt = `${mealPlanFromSurveyPrompt(surveyData)}

### User Input:
${JSON.stringify(surveyData, null, 2)}
${ingredientPreferencesSection}

${providedRecipesSection}

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
1) Recipes with source="saved" are user-selected anchors. NEVER replace, remove, or swap them with different dishes. Only make minimal compliance edits if required (allergies, exclusions, dietary restrictions, unit corrections, serving scaling).
2) If a provided recipe violates exclusions/restrictions (Question '13' - excluded ingredients, allergies Q7, dietary restrictions Q6), you MUST modify it to remove or replace those ingredients while preserving saved recipe identity.
3) Recipes with source="ai_candidate" can be modified more freely to align with goals.
4) Recipes may be reused across multiple slots by referencing the same recipeId in the schedule (after modification).
5) When cost efficiency is a priority, MODIFY recipes to consolidate ingredients - use the same ingredients across multiple recipes to maximize reuse.
6) Every recipe with source="saved" must appear in schedule at least once if there is a matching meal slot type.

### Household Size (Question 2) - Servings per Meal:
Based on user's household size, set portionMultiplier for each schedule entry:
- "Just me" → portionMultiplier = 1 (1 serving per meal)
- "2 people" → portionMultiplier = 2 (2 servings per meal)
- "3-4 people" → portionMultiplier = 3 (3 servings per meal)
- "5+ people" → portionMultiplier = 4 (4 servings per meal)

IMPORTANT: Each schedule entry's portionMultiplier should reflect servings needed for that specific meal slot based on household size. The user's household size is: "${householdSize || 'Just me'}" which means ${servingsPerMeal} serving(s) per meal.

CRITICAL: When modifying recipes, you MUST adjust ingredient quantities to match the serving size. The provided recipes may have different serving sizes - you need to scale all ingredients proportionally to match the target serving size (${servingsPerMeal} serving(s) per meal). Maintain ingredient ratios when scaling.

### Servings + Portions rule (MANDATORY)
- Each schedule entry has a portionMultiplier (integer >= 1).
- Set portionMultiplier = ${servingsPerMeal} for ALL schedule entries (based on household size: "${householdSize || 'Just me'}").
- For each recipeId, compute: totalPortionsAssigned = sum(portionMultiplier) across all schedule entries using that recipeId.
- Set recipes[].servings = totalPortionsAssigned for that recipe.
  (Example: if recipe-abc appears in 3 slots with multipliers ${servingsPerMeal},${servingsPerMeal},${servingsPerMeal} then servings must be ${servingsPerMeal * 3})

### Required process (follow exactly)
1) MODIFY each provided recipe to align with user goals, while preserving all source="saved" recipe identity:
   ${requiresProtein ? '- For high protein goals: Add quality protein sources if missing' : ''}
   - For cost efficiency: Consolidate ingredients across ALL recipes (use same ingredients in multiple recipes)
   - Remove/replace excluded ingredients
   - Adjust for dietary restrictions and allergies
   - Ensure ingredients have valid quantities + units
   - Ensure steps are clear (4–10 steps)
2) Build the schedule array so that EVERY slot listed above is mapped to one of the modified recipe IDs.
3) For each slot:
   - Use the correct day + mealType from the slot label
   - recipeId must reference one of the modified recipes
   - portionMultiplier must be ${servingsPerMeal} for ALL slots (based on household size: "${householdSize || 'Just me'}")
4) Standardize ingredient names across ALL recipes:
   - Use consistent names (e.g., always "eggs" not "egg", always "chicken breast" not variations)
   - Consolidate similar ingredients (e.g., "chicken breast", "boneless chicken breast" → use "chicken breast")
   - Use plural forms consistently for countable items
5) Produce grocery_list with consolidated totals:
   - Use the EXACT SAME ingredient names from recipes (no variations)
   - Sum quantities for the same ingredient (e.g., if Recipe 1 has "2 cups eggs" and Recipe 2 has "1 cup eggs", grocery list should have "3 cups eggs")
   - DO NOT create duplicate entries for the same ingredient
6) VALIDATE before returning (MANDATORY):
   - ALL provided recipes are used (one distinct modified recipe per provided recipe).
   - source="saved" recipes are preserved as the same dish identity and each appears at least once in schedule where feasible.
   - schedule length equals ${resolvedSlots.length} and covers every slot exactly once.
   - Every schedule entry references a valid recipe ID.
   - Every recipe.servings equals the total portions assigned to that recipe across schedule.
   - Every schedule entry's portionMultiplier equals ${servingsPerMeal} (household size: "${householdSize || 'Just me'}").
   - Units comply (no "tbsp"; use "tbs" or "tb").
   ${requiresProtein ? '- Protein requirement satisfied for every recipe when triggered (recipes must be modified to include quality protein sources).' : ''}
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
      - Recipes with source="saved" are user-selected anchors. NEVER replace, remove, or swap them; only minimal compliance edits are allowed.
      - Recipes with source="ai_candidate" can be modified for goals (protein requirements, cost efficiency via ingredient consolidation, etc.).
      - Fill every requested slot exactly once in the schedule.
      - Every source="saved" recipe must appear in schedule at least once where matching slot type exists.
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


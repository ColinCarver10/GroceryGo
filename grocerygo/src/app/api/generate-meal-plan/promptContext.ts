import type { SelectedSavedRecipeIds } from './candidateMerge'

interface MealSelection {
  breakfast: number
  lunch: number
  dinner: number
}

interface RecipeWithId {
  recipe_id: string
}

type RecipeSource = 'saved' | 'ai_candidate'

export function computeRemainingCounts(
  distinctCounts: MealSelection,
  validSelectedSavedIds: SelectedSavedRecipeIds
): MealSelection {
  return {
    breakfast: Math.max(distinctCounts.breakfast - Math.min(validSelectedSavedIds.breakfast.length, distinctCounts.breakfast), 0),
    lunch: Math.max(distinctCounts.lunch - Math.min(validSelectedSavedIds.lunch.length, distinctCounts.lunch), 0),
    dinner: Math.max(distinctCounts.dinner - Math.min(validSelectedSavedIds.dinner.length, distinctCounts.dinner), 0)
  }
}

export function normalizeSelectedSavedRecipeIds(
  selectedSavedRecipeIds: SelectedSavedRecipeIds
): SelectedSavedRecipeIds {
  const normalize = (ids: string[]) =>
    Array.from(new Set(ids.map((id) => String(id).trim()).filter((id) => id.length > 0)))

  return {
    breakfast: normalize(selectedSavedRecipeIds.breakfast ?? []),
    lunch: normalize(selectedSavedRecipeIds.lunch ?? []),
    dinner: normalize(selectedSavedRecipeIds.dinner ?? [])
  }
}

export function annotateRecipesWithSource<T extends RecipeWithId>(
  recipes: T[],
  savedIds: string[]
): Array<T & { source: RecipeSource }> {
  const savedSet = new Set(savedIds)
  return recipes.map((recipe) => ({
    ...recipe,
    source: savedSet.has(recipe.recipe_id) ? 'saved' : 'ai_candidate'
  }))
}

export function buildProvidedRecipesPromptSection(params: {
  distinctCounts: MealSelection
  breakfastRecipes: RecipeWithId[]
  lunchRecipes: RecipeWithId[]
  dinnerRecipes: RecipeWithId[]
  validSelectedSavedIds: SelectedSavedRecipeIds
}): string {
  const breakfastWithSource = annotateRecipesWithSource(
    params.breakfastRecipes,
    params.validSelectedSavedIds.breakfast
  )
  const lunchWithSource = annotateRecipesWithSource(
    params.lunchRecipes,
    params.validSelectedSavedIds.lunch
  )
  const dinnerWithSource = annotateRecipesWithSource(
    params.dinnerRecipes,
    params.validSelectedSavedIds.dinner
  )

  return `### provided_recipes:
You have been provided with exactly ONE recipe for each distinct meal type needed:
- ${params.distinctCounts.breakfast} Breakfast recipe(s):
${JSON.stringify(breakfastWithSource, null, 2)}
- ${params.distinctCounts.lunch} Lunch recipe(s):
${JSON.stringify(lunchWithSource, null, 2)}
- ${params.distinctCounts.dinner} Dinner recipe(s):
${JSON.stringify(dinnerWithSource, null, 2)}

Recipe source semantics:
- source: "saved" means user-selected saved recipe. Preserve dish identity (name + core dish) and do NOT replace it with a different recipe.
- source: "ai_candidate" means AI-selected candidate; these can be modified more freely to satisfy goals.
`
}

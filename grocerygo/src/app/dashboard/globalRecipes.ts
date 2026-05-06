import type { Recipe } from '@/types/database'

export interface GlobalRecipeRow {
  recipe_id: string
  created_at: string
  recipe: Recipe | null
}

export interface GlobalRecipeItem {
  recipe: Recipe
  saveCount: number
  latestSavedAt: string
}

export interface GlobalRecipesQueryParams {
  search?: string
  mealType?: string
  limit?: number
  offset?: number
}

export interface GlobalRecipesResult {
  recipes: GlobalRecipeItem[]
  total: number
  hasMore: boolean
}

function normalizeMealTypes(mealType: Recipe['meal_type'] | string | null | undefined): string[] {
  if (!mealType) return []
  if (Array.isArray(mealType)) {
    return mealType.map((value) => String(value).trim().toLowerCase()).filter(Boolean)
  }
  return [String(mealType).trim().toLowerCase()].filter(Boolean)
}

function getSearchableText(recipe: Recipe): string {
  const name = recipe.name || ''
  const ingredientText = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map((ing) => `${ing.item} ${ing.quantity ?? ''} ${ing.unit ?? ''}`).join(' ')
    : ''
  const tagText = [
    ...(recipe.dietary_tags ?? []),
    ...(recipe.flavor_profile ?? []),
    ...(recipe.cuisine_type ?? [])
  ].join(' ')

  return `${name} ${ingredientText} ${tagText}`.toLowerCase()
}

function recipeMatchesFilters(recipe: Recipe, search?: string, mealType?: string): boolean {
  const normalizedSearch = search?.trim().toLowerCase()
  if (normalizedSearch) {
    const searchable = getSearchableText(recipe)
    if (!searchable.includes(normalizedSearch)) {
      return false
    }
  }

  const normalizedMealType = mealType?.trim().toLowerCase()
  if (normalizedMealType && normalizedMealType !== 'all') {
    const mealTypes = normalizeMealTypes(recipe.meal_type as Recipe['meal_type'] | string | null | undefined)
    if (mealTypes.length > 0 && !mealTypes.includes(normalizedMealType)) {
      return false
    }
  }

  return true
}

export function buildGlobalRecipesResult(
  rows: GlobalRecipeRow[],
  params: GlobalRecipesQueryParams = {}
): GlobalRecipesResult {
  const limit = Math.max(params.limit ?? 20, 1)
  const offset = Math.max(params.offset ?? 0, 0)
  const recipeMap = new Map<string, GlobalRecipeItem>()

  for (const row of rows) {
    const recipe = row.recipe
    if (!recipe || !recipe.id) continue
    if (!recipeMatchesFilters(recipe, params.search, params.mealType)) continue

    const existing = recipeMap.get(recipe.id)
    if (existing) {
      existing.saveCount += 1
      if (new Date(row.created_at).getTime() > new Date(existing.latestSavedAt).getTime()) {
        existing.latestSavedAt = row.created_at
      }
      continue
    }

    recipeMap.set(recipe.id, {
      recipe,
      saveCount: 1,
      latestSavedAt: row.created_at
    })
  }

  const rankedRecipes = Array.from(recipeMap.values()).sort((a, b) => {
    if (b.saveCount !== a.saveCount) return b.saveCount - a.saveCount
    return new Date(b.latestSavedAt).getTime() - new Date(a.latestSavedAt).getTime()
  })

  const paginated = rankedRecipes.slice(offset, offset + limit)

  return {
    recipes: paginated,
    total: rankedRecipes.length,
    hasMore: offset + limit < rankedRecipes.length
  }
}

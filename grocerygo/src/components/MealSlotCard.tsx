'use client'

import type { MealPlanRecipe, Recipe, Ingredient } from '@/types/database'
import RecipeCardActions from '@/components/RecipeCardActions'
import { getIngredients } from '@/utils/mealPlanUtils'

export interface MealSlotCardProps {
  mealPlanRecipe: MealPlanRecipe & { recipe: Recipe }
  favoriteRecipes: Set<string>
  onRecipeClick: (recipe: Recipe, slots: MealPlanRecipe[]) => void
  onReplace: (recipeId: string, mealType?: string | null) => Promise<void>
  onToggleFavorite: (recipeId: string, isFavorite: boolean) => Promise<void>
}

export default function MealSlotCard({
  mealPlanRecipe,
  favoriteRecipes,
  onRecipeClick,
  onReplace,
  onToggleFavorite
}: MealSlotCardProps) {
  const { recipe } = mealPlanRecipe
  const isFavorite = favoriteRecipes.has(recipe.id)
  const mealType = mealPlanRecipe.meal_type
  const uniqueMealTypes = Array.from(
    new Set(
      [mealType || recipe.meal_type]
        .flatMap(value => (Array.isArray(value) ? value : [value]))
        .filter(Boolean)
    )
  )
  const primaryMealType = uniqueMealTypes[0]
  const ingredients = getIngredients(recipe)

  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-3 sm:p-4 md:p-6 transition-all hover:border-[var(--gg-primary)] hover:shadow-md flex flex-col h-full">
      <div className="flex items-start justify-between mb-2 sm:mb-3 md:mb-4">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 flex-1 pr-2 sm:pr-3 capitalize">{recipe.name}</h3>
        {primaryMealType && (
          <span className="inline-flex items-center justify-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-[var(--gg-primary)] text-xs font-semibold text-white capitalize ml-1 sm:ml-2 flex-shrink-0">
            {primaryMealType}
          </span>
        )}
      </div>

      <div className="mb-2 sm:mb-3 md:mb-4 flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600">
        {recipe.prep_time_minutes && (
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {recipe.prep_time_minutes}m
          </span>
        )}
        {recipe.servings && (
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="hidden sm:inline">{recipe.servings} servings cooked</span>
            <span className="sm:hidden">{recipe.servings}</span>
          </span>
        )}
        {(mealPlanRecipe.portion_multiplier ?? 1) > 1 && (
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 12h14M5 16h14" />
            </svg>
            ×{mealPlanRecipe.portion_multiplier}
          </span>
        )}
      </div>

      <div className="mb-2 sm:mb-3 md:mb-4">
        <p className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">Ingredients:</p>
        <ul className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-gray-600">
          {ingredients.slice(0, 3).map((ing: Ingredient, idx: number) => (
            <li key={idx} className="flex items-start gap-1 sm:gap-2">
              <span className="text-[var(--gg-primary)]">•</span>
              <span className="line-clamp-1">{ing.ingredient}</span>
            </li>
          ))}
          {ingredients.length > 3 && (
            <li className="text-gray-400 text-xs">
              +{ingredients.length - 3} more...
            </li>
          )}
        </ul>
      </div>

      <div className="mt-auto">
        <div className="mb-2 sm:mb-3">
          <RecipeCardActions
            recipeId={recipe.id}
            recipeName={recipe.name}
            isFavorite={isFavorite}
            onReplace={(id) => onReplace(id, mealType)}
            onToggleFavorite={onToggleFavorite}
          />
        </div>

        <button
          onClick={() => onRecipeClick(recipe, [mealPlanRecipe])}
          className="gg-btn-outline w-full text-xs sm:text-sm py-1.5 sm:py-2"
        >
          View Full Recipe
        </button>
      </div>
    </div>
  )
}


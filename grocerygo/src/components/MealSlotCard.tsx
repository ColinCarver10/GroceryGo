'use client'

import type { MealPlanRecipe, Recipe, Ingredient } from '@/types/database'
import RecipeCardActions from '@/components/RecipeCardActions'
import { getIngredients, scaleIngredient } from '@/utils/mealPlanUtils'

export interface MealSlotCardProps {
  mealPlanRecipe: MealPlanRecipe & { recipe: Recipe }
  favoriteRecipes: Set<string>
  onRecipeClick: (recipe: Recipe, slots: MealPlanRecipe[]) => void
  onReplace: (recipeId: string, mealType?: string | null) => Promise<void>
  onToggleFavorite: (recipeId: string, isFavorite: boolean) => Promise<void>
  allMealPlanRecipes?: (MealPlanRecipe & { recipe: Recipe })[]
  isReplacing?: boolean // Whether this recipe is currently being replaced
}

export default function MealSlotCard({
  mealPlanRecipe,
  favoriteRecipes,
  onRecipeClick,
  onReplace,
  onToggleFavorite,
  allMealPlanRecipes,
  isReplacing = false
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
  const baseIngredients = getIngredients(recipe)
  const portionMultiplier = mealPlanRecipe.portion_multiplier ?? 1
  // Scale ingredients by portion multiplier for this specific meal slot
  const ingredients = baseIngredients.map(ing => ({
    ...ing,
    ingredient: scaleIngredient(ing.ingredient, portionMultiplier)
  }))

  // Get all other days with the same recipe to show planned days
  const getPlannedDays = () => {
    if (!allMealPlanRecipes) return []
    
    const currentRecipeId = String(mealPlanRecipe.recipe_id)
    const currentDate = mealPlanRecipe.planned_for_date
    
    // Count total occurrences of this recipe_id
    const totalOccurrences = allMealPlanRecipes.filter(
      mpr => String(mpr.recipe_id) === currentRecipeId
    ).length
    
    // Only show if recipe is used more than once
    if (totalOccurrences <= 1) return []
    
    // Get other slots with same recipe_id but different date
    const otherSlots = allMealPlanRecipes.filter(
      mpr => String(mpr.recipe_id) === currentRecipeId && 
             mpr.planned_for_date !== currentDate &&
             mpr.planned_for_date // must have a date
    )
    
    if (otherSlots.length === 0) return []
    
    const dayMap = new Map<string, Date>()
    otherSlots.forEach(slot => {
      if (slot.planned_for_date) {
        const date = new Date(slot.planned_for_date + 'T00:00:00')
        if (!Number.isNaN(date.getTime())) {
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
          // Only use day name, no date
          if (!dayMap.has(dayName) || date < dayMap.get(dayName)!) {
            dayMap.set(dayName, date)
          }
        }
      }
    })
    
    return Array.from(dayMap.entries())
      .sort((a, b) => a[1].getTime() - b[1].getTime())
      .map(([label]) => label)
  }

  const plannedDays = getPlannedDays()

  // Calculate total weekly servings when recipe is used multiple times
  const totalWeeklyServings = allMealPlanRecipes
    ?.filter(mpr => String(mpr.recipe_id) === String(mealPlanRecipe.recipe_id))
    .reduce((sum, mpr) => sum + (mpr.portion_multiplier ?? 1), 0) ?? 0

  const currentSlotServings = mealPlanRecipe.portion_multiplier ?? 1
  const showWeeklyTotal = totalWeeklyServings > currentSlotServings && totalWeeklyServings > 0

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
        {plannedDays.length > 0 && (
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">Also planned for {plannedDays.join(', ')}</span>
            <span className="sm:hidden">Also: {plannedDays.length} day{plannedDays.length === 1 ? '' : 's'}</span>
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
        {showWeeklyTotal && (
          <span className="flex items-center gap-1 font-semibold text-[var(--gg-primary)]">
            <svg className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="hidden sm:inline">Total: {totalWeeklyServings} servings this week</span>
            <span className="sm:hidden">{totalWeeklyServings} total</span>
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
            isReplacing={isReplacing}
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


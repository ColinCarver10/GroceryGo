'use server'

import { revalidateTag } from 'next/cache'
import {
  createMealPlanContext,
  getMealPlanForUser,
  persistGeneratedMealPlan,
  type GroceryItemInput,
  type RecipeInput,
  type ScheduleInput
} from '@/services/mealPlanService'

interface SavedRecipe {
  id?: string
  name: string
  mealType?: string
  ingredients: Array<{
    item: string
    quantity: string
  }>
  steps: string[]
  description?: string
  prep_time_minutes?: number
  cook_time_minutes?: number
  servings?: number
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  cuisine_type?: string[]
  dietary_tags?: string[]
  flavor_profile?: string[]
  estimated_cost?: number
  nutrition_info?: {
    calories?: number
    protein?: number
    carbs?: number
    fat?: number
  }
}

interface GroceryListItem {
  item: string
  quantity: string
}

interface GroceryListStructure {
  items: Array<{ item: string; quantity: string }>
  seasonings: Array<{ item: string; quantity: string }>
}

interface ScheduleEntry {
  slotLabel: string
  day: string
  mealType: string
  recipeId: string
  portionMultiplier: number
}

export async function saveGeneratedRecipes(
  mealPlanId: string,
  recipes: SavedRecipe[],
  groceryList: GroceryListStructure,
  schedule: ScheduleEntry[] = []
) {
  try {
    const context = await createMealPlanContext()
    const mealPlan = await getMealPlanForUser(context, mealPlanId)

    if (!mealPlan) {
      return {
        success: false,
        error: 'Meal plan not found or does not belong to you'
      }
    }

    const snapshot = (mealPlan.survey_snapshot || {}) as Record<string, unknown>
    const selectedSaved = snapshot.selected_saved_recipe_ids as
      | { breakfast?: string[]; lunch?: string[]; dinner?: string[] }
      | undefined

    const lockedSavedRecipeIds = [
      ...(selectedSaved?.breakfast ?? []),
      ...(selectedSaved?.lunch ?? []),
      ...(selectedSaved?.dinner ?? [])
    ].map((id) => String(id))

    if (lockedSavedRecipeIds.length > 0) {
      const recipeIdsInPayload = new Set(
        recipes
          .map((recipe) => recipe.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
      const missingSavedRecipes = lockedSavedRecipeIds.filter((id) => !recipeIdsInPayload.has(id))
      if (missingSavedRecipes.length > 0) {
        return {
          success: false,
          error: 'Generation rejected: selected saved recipes were replaced before save.'
        }
      }

      const scheduleRecipeIds = new Set(schedule.map((slot) => String(slot.recipeId)))
      const unscheduledSavedRecipes = lockedSavedRecipeIds.filter((id) => !scheduleRecipeIds.has(id))
      if (unscheduledSavedRecipes.length > 0) {
        return {
          success: false,
          error: 'Generation rejected: selected saved recipes were not scheduled before save.'
        }
      }
    }

    await persistGeneratedMealPlan(context, {
      mealPlan,
      recipes: recipes as RecipeInput[],
      groceryList,
      schedule: schedule as ScheduleInput[]
    })

    revalidateTag('dashboard')

    return {
      success: true,
      mealPlanId
    }
  } catch (error: unknown) {
    console.error('Error in saveGeneratedRecipes:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
  }
}


'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidateTag } from 'next/cache'
import type { RecipeInsert, GroceryItemInsert, MealPlanRecipeInsert } from '@/types/database'

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
  groceryList: GroceryListItem[],
  schedule: ScheduleEntry[] = []
) {
  const supabase = await createClient()

  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Verify meal plan belongs to user
    const { data: mealPlan, error: mealPlanError } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('id', mealPlanId)
      .eq('user_id', user.id)
      .single()

    if (mealPlanError || !mealPlan) {
      return { success: false, error: 'Meal plan not found or does not belong to you' }
    }

    // Create recipes
    const recipeIds: string[] = []
    const recipeIdMap: Record<string, string> = {}
    const recipeErrors: string[] = []
    
    for (const aiRecipe of recipes) {
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          name: aiRecipe.name,
          ingredients: aiRecipe.ingredients,
          steps: aiRecipe.steps,
          meal_type: aiRecipe.mealType ? aiRecipe.mealType : null,
          description: aiRecipe.description,
          prep_time_minutes: aiRecipe.prep_time_minutes,
          cook_time_minutes: aiRecipe.cook_time_minutes,
          servings: aiRecipe.servings,
          difficulty: aiRecipe.difficulty,
          cuisine_type: aiRecipe.cuisine_type,
          dietary_tags: aiRecipe.dietary_tags,
          flavor_profile: aiRecipe.flavor_profile,
          estimated_cost: aiRecipe.estimated_cost,
          nutrition_info: aiRecipe.nutrition_info,
          times_used: 1
        } as RecipeInsert)
        .select()
        .single()

      if (recipeError) {
        console.error('Error creating recipe:', aiRecipe.name, recipeError)
        recipeErrors.push(`${aiRecipe.name}: ${recipeError.message}`)
        continue
      }

      if (newRecipe) {
        recipeIds.push(newRecipe.id)
        const fallbackId = aiRecipe.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        if (aiRecipe.mealType) {
          recipeIdMap[`${aiRecipe.mealType.toLowerCase()}-${fallbackId}`] = newRecipe.id
        }
        recipeIdMap[fallbackId] = newRecipe.id
        if (aiRecipe.id) {
          recipeIdMap[aiRecipe.id] = newRecipe.id
        }
      }
    }

    if (recipeIds.length === 0) {
      console.error('No recipes were created successfully. Errors:', recipeErrors)
      return { 
        success: false, 
        error: `Failed to create recipes. Errors: ${recipeErrors.join('; ')}` 
      }
    }

    // Link recipes to meal plan
    let mealPlanRecipes = recipeIds.map((recipeId, index) => ({
      meal_plan_id: mealPlanId,
      recipe_id: recipeId,
      planned_for_date: getDateForMealIndex(mealPlan.week_of, index),
      portion_multiplier: 1 as number
    }))

    if (schedule.length > 0) {
      mealPlanRecipes = schedule.reduce<MealPlanRecipeInsert[]>((acc, slot, index) => {
        const normalizedMealType = slot.mealType?.toLowerCase()
        const directMatch = recipeIdMap[slot.recipeId]
        const mealTypeFallback = normalizedMealType
          ? recipeIdMap[`${normalizedMealType}-${slot.recipeId}`]
          : undefined
        const linkedRecipeId = directMatch || mealTypeFallback

        if (!linkedRecipeId) {
          console.warn(`Schedule entry ${index} references missing recipe id ${slot.recipeId}`)
          return acc
        }

        acc.push({
          meal_plan_id: mealPlanId,
          recipe_id: linkedRecipeId,
          planned_for_date: getDateForDayName(mealPlan.week_of, slot.day),
          meal_type: normalizedMealType as 'breakfast' | 'lunch' | 'dinner' | undefined,
          portion_multiplier: slot.portionMultiplier || 1,
          slot_label: slot.slotLabel || `${slot.day} ${slot.mealType}`
        })

        return acc
      }, [])
    }

    const { error: linkError } = await supabase
      .from('meal_plan_recipes')
      .insert(mealPlanRecipes)

    if (linkError) {
      console.error('Error linking recipes to meal plan:', linkError)
      return { success: false, error: `Failed to link recipes: ${linkError.message}` }
    }

    // Create grocery list items
    const groceryItems: GroceryItemInsert[] = groceryList.map(item => ({
      meal_plan_id: mealPlanId,
      item_name: item.item,
      quantity: parseQuantity(item.quantity),
      unit: parseUnit(item.quantity),
      purchased: false
    }))

    const { error: groceryError } = await supabase
      .from('grocery_items')
      .insert(groceryItems)

    if (groceryError) {
      console.error('Error creating grocery items:', groceryError)
      return { success: false, error: `Failed to create grocery items: ${groceryError.message}` }
    }

    // Update meal plan status to pending
    const { error: updateError } = await supabase
      .from('meal_plans')
      .update({
        status: 'pending',
        total_meals: schedule.length > 0 ? schedule.length : recipeIds.length
      })
      .eq('id', mealPlanId)

    if (updateError) {
      console.error('Error updating meal plan status:', updateError)
      return { success: false, error: `Failed to update meal plan status: ${updateError.message}` }
    }

    // Invalidate cache
    revalidateTag('dashboard')

    return {
      success: true,
      mealPlanId
    }

  } catch (error: any) {
    console.error('Error in saveGeneratedRecipes:', error)
    return {
      success: false,
      error: `An unexpected error occurred: ${error?.message || error}`
    }
  }
}

// Helper functions
function getDateForMealIndex(weekOf: string, index: number): string {
  const startDate = new Date(weekOf)
  const dayOffset = index % 7
  const mealDate = new Date(startDate)
  mealDate.setDate(startDate.getDate() + dayOffset)
  return mealDate.toISOString().split('T')[0]
}

function getDateForDayName(weekOf: string, dayName?: string): string | undefined {
  if (!dayName) return undefined

  const normalizedDay = dayName.trim().toLowerCase()
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  }

  const targetOffset = dayMap[normalizedDay]

  if (targetOffset === undefined) {
    return undefined
  }

  const startDate = new Date(weekOf)
  if (Number.isNaN(startDate.getTime())) {
    return undefined
  }

  const startDayIndex = dayMap[startDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()] ?? 1
  const offset = targetOffset - startDayIndex

  const mealDate = new Date(startDate)
  mealDate.setDate(startDate.getDate() + offset)

  return mealDate.toISOString().split('T')[0]
}

function parseQuantity(quantityStr: string): number | undefined {
  const match = quantityStr.match(/^([\d.]+)/)
  return match ? parseFloat(match[1]) : undefined
}

function parseUnit(quantityStr: string): string | undefined {
  const match = quantityStr.match(/^[\d.]+\s*(.+)/)
  return match ? match[1].trim() : undefined
}


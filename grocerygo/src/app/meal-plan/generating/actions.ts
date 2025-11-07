'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidateTag } from 'next/cache'
import type { RecipeInsert, GroceryItemInsert } from '@/types/database'
import { getDateForMealIndex, getDateForScheduledMeal } from '@/utils/mealPlanDates'

interface SavedRecipe {
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

export async function saveGeneratedRecipes(
  mealPlanId: string,
  recipes: SavedRecipe[],
  groceryList: GroceryListItem[]
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
      }
    }

    if (recipeIds.length === 0) {
      console.error('No recipes were created successfully. Errors:', recipeErrors)
      return { 
        success: false, 
        error: `Failed to create recipes. Errors: ${recipeErrors.join('; ')}` 
      }
    }

    // Link recipes to meal plan with dates from schedule
    const mealSchedule = mealPlan.survey_snapshot?.meal_schedule || []
    
    const mealPlanRecipes = recipeIds.map((recipeId, index) => {
      // Use the schedule if available, otherwise fall back to old method
      const scheduleEntry = mealSchedule[index]
      
      return {
        meal_plan_id: mealPlanId,
        recipe_id: recipeId,
        planned_for_date: scheduleEntry 
          ? getDateForScheduledMeal(mealPlan.week_of, scheduleEntry.day)
          : getDateForMealIndex(mealPlan.week_of, index),
        meal_type: scheduleEntry?.mealType || recipes[index].mealType?.toLowerCase()
      }
    })

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
      .update({ status: 'pending' })
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
function parseQuantity(quantityStr: string): number | undefined {
  const match = quantityStr.match(/^([\d.]+)/)
  return match ? parseFloat(match[1]) : undefined
}

function parseUnit(quantityStr: string): string | undefined {
  const match = quantityStr.match(/^[\d.]+\s*(.+)/)
  return match ? match[1].trim() : undefined
}


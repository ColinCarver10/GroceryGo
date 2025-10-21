'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidateTag } from 'next/cache'
import type {
  MealPlanInsert,
  RecipeInsert,
  MealPlanRecipeInsert,
  GroceryItemInsert,
  AIGeneratedMealPlan,
  MealPlanWithRecipes
} from '@/types/database'

/**
 * Create a complete meal plan from AI-generated data
 * This is the main function you'll call after getting AI response
 * 
 * Note: Currently creates new recipes without deduplication.
 * Future optimization: Add vector-based recipe matching using pgvector
 * to intelligently deduplicate similar recipes.
 */
export async function createMealPlanFromAI(
  userId: string,
  weekOf: string,
  aiResponse: AIGeneratedMealPlan,
  surveySnapshot?: Record<string, any>
) {
  const supabase = await createClient()

  try {
    // 1. Create the meal plan record
    const { data: mealPlan, error: mealPlanError } = await supabase
      .from('meal_plans')
      .insert({
        user_id: userId,
        week_of: weekOf,
        status: 'pending',
        total_meals: aiResponse.recipes.length,
        survey_snapshot: surveySnapshot,
        generation_method: 'ai-generated',
        ai_model: 'gpt-5'
      } as MealPlanInsert)
      .select()
      .single()

    if (mealPlanError) {
      console.error('Error creating meal plan:', mealPlanError)
      return { success: false, error: `Failed to create meal plan: ${mealPlanError.message}` }
    }

    // 2. Create recipes (vector-based deduplication to be added later)
    const recipeIds: string[] = []
    const recipeErrors: string[] = []
    
    for (const aiRecipe of aiResponse.recipes) {
      // Create new recipe for this meal plan
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          name: aiRecipe.name,
          ingredients: aiRecipe.ingredients,
          steps: aiRecipe.steps,
          meal_type: aiRecipe.mealType ? aiRecipe.mealType : null,
          times_used: 1
        } as RecipeInsert)
        .select()
        .single()

      if (recipeError) {
        console.error('Error creating recipe:', aiRecipe.name, recipeError)
        recipeErrors.push(`${aiRecipe.name}: ${recipeError.message}`)
        continue // Skip this recipe but continue with others
      }

      if (newRecipe) {
        recipeIds.push(newRecipe.id)
      }
    }

    // Check if we created any recipes
    if (recipeIds.length === 0) {
      console.error('No recipes were created successfully. Errors:', recipeErrors)
      return { 
        success: false, 
        error: `Failed to create recipes. Errors: ${recipeErrors.join('; ')}` 
      }
    }

    // 3. Link recipes to meal plan
    const mealPlanRecipes: MealPlanRecipeInsert[] = recipeIds.map((recipeId, index) => ({
      meal_plan_id: mealPlan.id,
      recipe_id: recipeId,
      // Distribute meals across the week (assuming 7 days)
      planned_for_date: getDateForMealIndex(weekOf, index)
    }))

    const { error: linkError } = await supabase
      .from('meal_plan_recipes')
      .insert(mealPlanRecipes)

    if (linkError) {
      console.error('Error linking recipes to meal plan:', linkError)
      return { success: false, error: `Failed to link recipes: ${linkError.message}` }
    }

    // 4. Create grocery list items
    const groceryItems: GroceryItemInsert[] = aiResponse.grocery_list.map(item => ({
      meal_plan_id: mealPlan.id,
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

    // Invalidate cache
    revalidateTag('dashboard')

    return {
      success: true,
      mealPlanId: mealPlan.id,
      data: mealPlan
    }

  } catch (error: any) {
    console.error('Error in createMealPlanFromAI:', error)
    return {
      success: false,
      error: `An unexpected error occurred: ${error?.message || error}`
    }
  }
}

/**
 * Get all meal plans for a user with full details
 */
export async function getUserMealPlans(userId: string): Promise<MealPlanWithRecipes[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('meal_plans')
    .select(`
      *,
      meal_plan_recipes (
        *,
        recipe:recipes (*)
      ),
      grocery_items (*)
    `)
    .eq('user_id', userId)
    .order('week_of', { ascending: false })

  if (error) {
    console.error('Error fetching meal plans:', error)
    return []
  }

  return data as MealPlanWithRecipes[]
}

/**
 * Get a single meal plan with all details
 */
export async function getMealPlanById(mealPlanId: string, userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('meal_plans')
    .select(`
      *,
      meal_plan_recipes (
        *,
        recipe:recipes (*)
      ),
      grocery_items (*)
    `)
    .eq('id', mealPlanId)
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('Error fetching meal plan:', error)
    return null
  }

  return data as MealPlanWithRecipes
}

/**
 * Update meal plan status
 */
export async function updateMealPlanStatus(
  mealPlanId: string,
  userId: string,
  status: 'completed' | 'in-progress' | 'pending'
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('meal_plans')
    .update({ status })
    .eq('id', mealPlanId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating meal plan status:', error)
    return { success: false, error: 'Failed to update status' }
  }

  revalidateTag('dashboard')
  return { success: true }
}

/**
 * Delete a meal plan (cascade will handle recipes and grocery items)
 */
export async function deleteMealPlan(mealPlanId: string, userId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('meal_plans')
    .delete()
    .eq('id', mealPlanId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting meal plan:', error)
    return { success: false, error: 'Failed to delete meal plan' }
  }

  revalidateTag('dashboard')
  return { success: true }
}

/**
 * Toggle grocery item purchased status
 */
export async function toggleGroceryItemPurchased(itemId: string, purchased: boolean) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('grocery_items')
    .update({
      purchased,
      purchased_at: purchased ? new Date().toISOString() : null
    })
    .eq('id', itemId)

  if (error) {
    console.error('Error updating grocery item:', error)
    return { success: false, error: 'Failed to update item' }
  }

  return { success: true }
}

// Helper functions
function getDateForMealIndex(weekOf: string, index: number): string {
  const startDate = new Date(weekOf)
  const dayOffset = index % 7 // Distribute meals across 7 days
  const mealDate = new Date(startDate)
  mealDate.setDate(startDate.getDate() + dayOffset)
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


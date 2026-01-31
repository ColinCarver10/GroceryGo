'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidateTag } from 'next/cache'
import type {
  MealPlanInsert,
  RecipeInsert,
  MealPlanRecipeInsert,
  GroceryItemInsert,
  AIGeneratedMealPlan,
  MealPlanWithRecipes,
  SurveyResponse
} from '@/types/database'
import { getDateForDayName } from '@/utils/mealPlanDates'
import { REGULAR_MODEL } from '@/config/aiModels'
import { logDatabaseError, logUnexpectedError } from '@/utils/errorLogger'

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
  surveySnapshot?: SurveyResponse
) {
  const supabase = await createClient()
  type GroupedResponse = AIGeneratedMealPlan & {
    breakfast?: AIGeneratedMealPlan['recipes']
    lunch?: AIGeneratedMealPlan['recipes']
    dinner?: AIGeneratedMealPlan['recipes']
  }

  const groupedResponse = aiResponse as GroupedResponse
  const allRecipes =
    Array.isArray(aiResponse.recipes) && aiResponse.recipes.length > 0
      ? aiResponse.recipes
      : [
          ...(groupedResponse.breakfast ?? []),
          ...(groupedResponse.lunch ?? []),
          ...(groupedResponse.dinner ?? [])
        ]

  const totalMeals = aiResponse.schedule?.length ?? allRecipes.length

  try {

    // 1. Create the meal plan record
    const { data: mealPlan, error: mealPlanError } = await supabase
      .from('meal_plans')
      .insert({
        user_id: userId,
        week_of: weekOf,
        status: 'pending',
        total_meals: totalMeals,
        survey_snapshot: surveySnapshot,
        generation_method: 'ai-generated',
        ai_model: REGULAR_MODEL
      } as MealPlanInsert)
      .select()
      .single()

    if (mealPlanError) {
      logDatabaseError('createMealPlanFromAI', mealPlanError, {
        table: 'meal_plans',
        operation: 'INSERT',
        queryParams: { user_id: userId, week_of: weekOf, total_meals: totalMeals }
      }, userId)
      return { success: false, error: `Failed to create meal plan: ${mealPlanError.message}` }
    }

    // 2. Create recipes (vector-based deduplication to be added later)
    const recipeIds: string[] = []
    const recipeIdMap: Record<string, string> = {}
    const recipeErrors: string[] = []
    
    for (const aiRecipe of allRecipes) {
      if (!aiRecipe.id) {
        recipeErrors.push(`${aiRecipe.name}: missing recipe id`)
        continue
      }

      // Create new recipe for this meal plan
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          name: aiRecipe.name,
          ingredients: aiRecipe.ingredients,
          steps: aiRecipe.steps,
          meal_type: aiRecipe.mealType ? aiRecipe.mealType : null,
          servings: aiRecipe.servings,
          times_used: 1
        } as RecipeInsert)
        .select()
        .single()

      if (recipeError) {
        logDatabaseError('createMealPlanFromAI', recipeError, {
          table: 'recipes',
          operation: 'INSERT',
          queryParams: { name: aiRecipe.name, meal_type: aiRecipe.mealType }
        }, userId)
        recipeErrors.push(`${aiRecipe.name}: ${recipeError.message}`)
        continue // Skip this recipe but continue with others
      }

      if (newRecipe) {
        recipeIds.push(newRecipe.id)
        recipeIdMap[aiRecipe.id] = newRecipe.id
      }
    }

    // Check if we created any recipes
    if (recipeIds.length === 0) {
      logDatabaseError('createMealPlanFromAI', new Error('No recipes were created successfully'), {
        table: 'recipes',
        operation: 'INSERT',
        queryParams: { recipeErrors }
      }, userId)
      return { 
        success: false, 
        error: `Failed to create recipes. Errors: ${recipeErrors.join('; ')}` 
      }
    }

    // 3. Link recipes to meal plan
    let mealPlanRecipes: MealPlanRecipeInsert[] = []

    if (aiResponse.schedule && aiResponse.schedule.length > 0) {
      mealPlanRecipes = aiResponse.schedule.reduce<MealPlanRecipeInsert[]>((acc, entry, index) => {
        const linkedRecipeId = recipeIdMap[entry.recipeId]

        if (!linkedRecipeId) {
          console.warn(`Schedule entry ${index} references missing recipe id ${entry.recipeId}`)
          return acc
        }

        const slotLabel = entry.slotLabel || `${entry.day} ${entry.mealType}`
        const plannedDate = getDateForDayName(weekOf, entry.day)

        acc.push({
          meal_plan_id: mealPlan.id,
          recipe_id: parseInt(linkedRecipeId),
          planned_for_date: plannedDate,
          meal_type: entry.mealType ? entry.mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner' : undefined,
          portion_multiplier: entry.portionMultiplier || 1,
          slot_label: slotLabel
        })

        return acc
      }, [])
    } else {
      mealPlanRecipes = recipeIds.map((recipeId, index) => ({
        meal_plan_id: mealPlan.id,
        recipe_id: parseInt(recipeId),
        planned_for_date: getDateForMealIndex(weekOf, index),
        portion_multiplier: 1
      }))
    }

    const { error: linkError } = await supabase
      .from('meal_plan_recipes')
      .insert(mealPlanRecipes)

    if (linkError) {
      logDatabaseError('createMealPlanFromAI', linkError, {
        table: 'meal_plan_recipes',
        operation: 'INSERT',
        queryParams: { meal_plan_id: mealPlan.id, recipeCount: mealPlanRecipes.length }
      }, userId)
      return { success: false, error: `Failed to link recipes: ${linkError.message}` }
    }

    // 4. Store total_ingredients from AI response
    if (aiResponse.grocery_list) {
      // Handle both old array format and new nested structure
      let totalIngredients: { items: Array<{ item: string; quantity: string }>; seasonings: Array<{ item: string; quantity: string }> } | null = null
      if (Array.isArray(aiResponse.grocery_list)) {
        // Old format: convert to new structure
        totalIngredients = {
          items: aiResponse.grocery_list.map(item => ({ ...item, checked: false })),
          seasonings: []
        }
      } else if (typeof aiResponse.grocery_list === 'object' && ('items' in aiResponse.grocery_list || 'seasonings' in aiResponse.grocery_list)) {
        // New format: use as-is, but ensure checked is false for new items
        const groceryList = aiResponse.grocery_list as { items?: Array<{ item: string; quantity: string }>; seasonings?: Array<{ item: string; quantity: string }> }
        totalIngredients = {
          items: (groceryList.items || []).map(item => ({ ...item, checked: false })),
          seasonings: (groceryList.seasonings || []).map(item => ({ ...item, checked: false }))
        }
      }

      if (totalIngredients && (totalIngredients.items.length > 0 || totalIngredients.seasonings.length > 0)) {
        const { error: updateError } = await supabase
          .from('meal_plans')
          .update({ total_ingredients: totalIngredients })
          .eq('id', mealPlan.id)

        if (updateError) {
          logDatabaseError('createMealPlanFromAI', updateError, {
            table: 'meal_plans',
            operation: 'UPDATE',
            queryParams: { id: mealPlan.id, user_id: userId }
          }, userId)
          // Don't fail the whole operation if this fails
        }
      }
    }

    // Invalidate cache
    revalidateTag('dashboard')

    return {
      success: true,
      mealPlanId: mealPlan.id,
      data: mealPlan
    }

  } catch (error: unknown) {
    logUnexpectedError('createMealPlanFromAI', error, {
      userId,
      weekOf,
      recipeCount: allRecipes.length
    })
    return {
      success: false,
      error: `An unexpected error occurred: ${
        error instanceof Error ? error.message : String(error)
      }`
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
        updated_recipe:recipes (*)
      ),
      grocery_items (*)
    `)
    .eq('user_id', userId)
    .order('week_of', { ascending: false })

  if (error) {
    logDatabaseError('getUserMealPlans', error, {
      table: 'meal_plans',
      operation: 'SELECT',
      queryParams: { user_id: userId }
    }, userId)
    return []
  }

  // Fetch parent recipes separately for meal_plan_recipes that don't have updated_recipe_id
  const mealPlanRecipes = (data || []).flatMap((plan: any) => plan.meal_plan_recipes || [])
  const parentRecipeIds = mealPlanRecipes
    .filter((mpr: any) => !mpr.updated_recipe_id && mpr.recipe_id)
    .map((mpr: any) => mpr.recipe_id)
    .filter((id: any, index: number, arr: any[]) => arr.indexOf(id) === index) // unique

  let parentRecipesMap = new Map()
  if (parentRecipeIds.length > 0) {
    const { data: parentRecipes } = await supabase
      .from('full_recipes_table')
      .select('recipe_id, name, nutrition, steps, description, ingredients, meal_type')
      .in('recipe_id', parentRecipeIds)

    if (parentRecipes) {
      parentRecipes.forEach((pr: any) => {
        parentRecipesMap.set(pr.recipe_id, pr)
      })
    }
  }

  // Transform data to use updated_recipe if available, fallback to parent_recipe
  const transformedData = (data || []).map((plan: any) => ({
    ...plan,
    meal_plan_recipes: (plan.meal_plan_recipes || []).map((mpr: any) => ({
      ...mpr,
      recipe: mpr.updated_recipe || parentRecipesMap.get(mpr.recipe_id) || null
    }))
  }))

  return transformedData as MealPlanWithRecipes[]
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
        updated_recipe:recipes (*)
      )
    `)
    .eq('id', mealPlanId)
    .eq('user_id', userId)
    .single()

  if (error) {
    logDatabaseError('getMealPlanById', error, {
      table: 'meal_plans',
      operation: 'SELECT',
      queryParams: { id: mealPlanId, user_id: userId }
    }, userId)
    return null
  }

  // Fetch parent recipes separately for meal_plan_recipes that don't have updated_recipe_id
  const mealPlanRecipes = data.meal_plan_recipes || []
  const parentRecipeIds = mealPlanRecipes
    .filter((mpr: any) => !mpr.updated_recipe_id && mpr.recipe_id)
    .map((mpr: any) => mpr.recipe_id)
    .filter((id: any, index: number, arr: any[]) => arr.indexOf(id) === index) // unique

  let parentRecipesMap = new Map()
  if (parentRecipeIds.length > 0) {
    const { data: parentRecipes } = await supabase
      .from('full_recipes_table')
      .select('recipe_id, name, nutrition, steps, description, ingredients, meal_type')
      .in('recipe_id', parentRecipeIds)

    if (parentRecipes) {
      parentRecipes.forEach((pr: any) => {
        parentRecipesMap.set(pr.recipe_id, pr)
      })
    }
  }

  // Transform data to use updated_recipe if available, fallback to parent_recipe
  const transformedData = {
    ...data,
    meal_plan_recipes: mealPlanRecipes.map((mpr: any) => ({
      ...mpr,
      recipe: mpr.updated_recipe || parentRecipesMap.get(mpr.recipe_id) || null
    }))
  }

  return transformedData as MealPlanWithRecipes
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
    logDatabaseError('updateMealPlanStatus', error, {
      table: 'meal_plans',
      operation: 'UPDATE',
      queryParams: { id: mealPlanId, user_id: userId, status }
    }, userId)
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
    logDatabaseError('deleteMealPlan', error, {
      table: 'meal_plans',
      operation: 'DELETE',
      queryParams: { id: mealPlanId, user_id: userId }
    }, userId)
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
    logDatabaseError('toggleGroceryItemPurchased', error, {
      table: 'grocery_items',
      operation: 'UPDATE',
      queryParams: { id: itemId, purchased }
    })
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


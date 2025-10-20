'use server'

import { createClient } from '@/utils/supabase/server'
import { trackMealPlanAction } from './feedbackHelper'
import type { SavedRecipeInsert } from '@/types/database'

/**
 * Add an ingredient to user's exclusion list
 * Stores in survey_response JSON field
 */
export async function excludeIngredient(
  userId: string,
  ingredientName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current survey response
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('survey_response')
      .eq('user_id', userId)
      .single()

    if (fetchError || !userData) {
      return { success: false, error: 'User not found' }
    }

    const surveyResponse = userData.survey_response || {}
    const excludedIngredients = surveyResponse.excluded_ingredients || []

    // Add if not already excluded
    if (!excludedIngredients.includes(ingredientName)) {
      excludedIngredients.push(ingredientName)
      
      const updatedSurvey = {
        ...surveyResponse,
        excluded_ingredients: excludedIngredients
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ survey_response: updatedSurvey })
        .eq('user_id', userId)

      if (updateError) {
        return { success: false, error: 'Failed to update preferences' }
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error excluding ingredient:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Add an ingredient to user's favorites list
 * Stores in survey_response JSON field
 */
export async function favorIngredient(
  userId: string,
  ingredientName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current survey response
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('survey_response')
      .eq('user_id', userId)
      .single()

    if (fetchError || !userData) {
      return { success: false, error: 'User not found' }
    }

    const surveyResponse = userData.survey_response || {}
    const favoredIngredients = surveyResponse.favored_ingredients || []

    // Add if not already favored
    if (!favoredIngredients.includes(ingredientName)) {
      favoredIngredients.push(ingredientName)
      
      const updatedSurvey = {
        ...surveyResponse,
        favored_ingredients: favoredIngredients
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ survey_response: updatedSurvey })
        .eq('user_id', userId)

      if (updateError) {
        return { success: false, error: 'Failed to update preferences' }
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error favoring ingredient:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Remove an ingredient from exclusion list
 */
export async function removeExcludedIngredient(
  userId: string,
  ingredientName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: userData } = await supabase
      .from('users')
      .select('survey_response')
      .eq('user_id', userId)
      .single()

    if (!userData) {
      return { success: false, error: 'User not found' }
    }

    const surveyResponse = userData.survey_response || {}
    const excludedIngredients = (surveyResponse.excluded_ingredients || [])
      .filter((ing: string) => ing !== ingredientName)

    const updatedSurvey = {
      ...surveyResponse,
      excluded_ingredients: excludedIngredients
    }

    await supabase
      .from('users')
      .update({ survey_response: updatedSurvey })
      .eq('user_id', userId)

    return { success: true }
  } catch (error) {
    console.error('Error removing excluded ingredient:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Save a recipe to user's saved recipes
 */
export async function saveRecipe(
  userId: string,
  recipeId: string,
  recipeName: string,
  mealPlanId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Check if already saved
    const { data: existing } = await supabase
      .from('saved_recipes')
      .select('id')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .single()

    if (existing) {
      return { success: true } // Already saved, no action needed
    }

    // Save recipe
    const { error: insertError } = await supabase
      .from('saved_recipes')
      .insert({
        user_id: userId,
        recipe_id: recipeId
      } as SavedRecipeInsert)

    if (insertError) {
      console.error('Error saving recipe:', insertError)
      return { success: false, error: 'Failed to save recipe' }
    }

    // Track action in feedback if part of a meal plan
    if (mealPlanId) {
      await trackMealPlanAction(
        mealPlanId,
        userId,
        `User saved recipe '${recipeName}' to favorites`
      )
    }

    return { success: true }
  } catch (error) {
    console.error('Error saving recipe:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Remove a recipe from user's saved recipes
 */
export async function unsaveRecipe(
  userId: string,
  recipeId: string,
  recipeName: string,
  mealPlanId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error: deleteError } = await supabase
      .from('saved_recipes')
      .delete()
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)

    if (deleteError) {
      console.error('Error unsaving recipe:', deleteError)
      return { success: false, error: 'Failed to remove saved recipe' }
    }

    // Track action in feedback if part of a meal plan
    if (mealPlanId) {
      await trackMealPlanAction(
        mealPlanId,
        userId,
        `User removed recipe '${recipeName}' from favorites`
      )
    }

    return { success: true }
  } catch (error) {
    console.error('Error unsaving recipe:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get all saved recipe IDs for a user
 */
export async function getSavedRecipeIds(userId: string): Promise<string[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('saved_recipes')
      .select('recipe_id')
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching saved recipes:', error)
      return []
    }

    return data.map(sr => sr.recipe_id)
  } catch (error) {
    console.error('Error fetching saved recipes:', error)
    return []
  }
}

/**
 * Get all saved recipes with full recipe details for a user
 */
export async function getSavedRecipes(userId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('saved_recipes')
      .select(`
        *,
        recipe:recipes (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching saved recipes:', error)
      return []
    }

    return data
  } catch (error) {
    console.error('Error fetching saved recipes:', error)
    return []
  }
}


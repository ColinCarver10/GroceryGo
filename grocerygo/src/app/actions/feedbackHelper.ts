'use server'

import { createClient } from '@/utils/supabase/server'
import type { MealPlanFeedbackInsert } from '@/types/database'
import { logDatabaseError } from '@/utils/errorLogger'

/**
 * Track user actions in the meal_plan_feedback table
 * Uses rating = -1 to distinguish system-generated tracking from user reviews
 * Appends actions to feedback_text with " | " separator
 */
export async function trackMealPlanAction(
  mealPlanId: string,
  userId: string,
  actionText: string
): Promise<void> {
  try {
    const supabase = await createClient()

    // Check if feedback entry exists with rating = -1
    const { data: existingFeedback } = await supabase
      .from('meal_plan_feedback')
      .select('*')
      .eq('meal_plan_id', mealPlanId)
      .eq('user_id', userId)
      .eq('rating', -1)
      .single()

    if (existingFeedback) {
      // Append to existing feedback
      const updatedText = existingFeedback.feedback_text
        ? `${existingFeedback.feedback_text} | ${actionText}`
        : actionText

      await supabase
        .from('meal_plan_feedback')
        .update({ feedback_text: updatedText })
        .eq('id', existingFeedback.id)
    } else {
      // Create new feedback entry
      await supabase
        .from('meal_plan_feedback')
        .insert({
          meal_plan_id: mealPlanId,
          user_id: userId,
          rating: -1,
          feedback_text: actionText
        })
    }
  } catch (error) {
    // Don't throw - feedback tracking shouldn't break the main flow
    logDatabaseError('trackMealPlanAction', error, {
      table: 'meal_plan_feedback',
      operation: 'INSERT/UPDATE',
      queryParams: { meal_plan_id: mealPlanId, user_id: userId }
    }, userId)
  }
}

/**
 * Submit or update user feedback for a meal plan
 * Handles both new submissions and updates to existing feedback
 * Uses rating 1-5 to distinguish from system tracking (rating = -1)
 */
export async function submitMealPlanFeedback(
  mealPlanId: string,
  userId: string,
  rating: number,
  feedbackText?: string,
  wouldMakeAgain?: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Validate rating is between 1-5
    if (rating < 1 || rating > 5) {
      return { success: false, error: 'Rating must be between 1 and 5' }
    }

    // Check if user feedback already exists (rating >= 1, not system tracking)
    const { data: existingFeedback } = await supabase
      .from('meal_plan_feedback')
      .select('*')
      .eq('meal_plan_id', mealPlanId)
      .eq('user_id', userId)
      .gte('rating', 1)
      .single()

    const feedbackData: MealPlanFeedbackInsert = {
      meal_plan_id: mealPlanId,
      user_id: userId,
      rating,
      feedback_text: feedbackText || '',
      would_make_again: wouldMakeAgain ?? false
    }

    if (existingFeedback) {
      // Update existing feedback
      const { error } = await supabase
        .from('meal_plan_feedback')
        .update(feedbackData)
        .eq('id', existingFeedback.id)

      if (error) {
        return { success: false, error: error.message }
      }
    } else {
      // Create new feedback entry
      const { error } = await supabase
        .from('meal_plan_feedback')
        .insert(feedbackData)

      if (error) {
        return { success: false, error: error.message }
      }
    }

    return { success: true }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    }
  }
}

/**
 * Fetch existing user feedback for a meal plan
 * Returns null if no feedback exists (rating >= 1, not system tracking)
 */
export async function getMealPlanFeedback(
  mealPlanId: string,
  userId: string
): Promise<{ id: string; rating: number; feedback_text: string | null; would_make_again: boolean | null; created_at: string } | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('meal_plan_feedback')
      .select('id, rating, feedback_text, would_make_again, created_at')
      .eq('meal_plan_id', mealPlanId)
      .eq('user_id', userId)
      .gte('rating', 1)
      .single()

    if (error) {
      // No feedback found is not an error
      if (error.code === 'PGRST116') {
        return null
      }
      return null
    }

    return data
  } catch (error) {
    return null
  }
}


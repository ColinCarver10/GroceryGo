'use server'

import { createClient } from '@/utils/supabase/server'

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
    console.error('Error tracking meal plan action:', error)
  }
}


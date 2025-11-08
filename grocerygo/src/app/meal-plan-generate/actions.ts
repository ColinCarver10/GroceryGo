'use server'

import { createClient } from '@/utils/supabase/server'

interface MealSelection {
  breakfast: number
  lunch: number
  dinner: number
}

interface MealScheduleEntry {
  day: string
  mealType: 'breakfast' | 'lunch' | 'dinner'
}

export async function generateMealPlanFromPreferences(
  weekOf: string,
  mealSelection: MealSelection,
  mealSchedule?: MealScheduleEntry[]
) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: 'User not authenticated' }
    }

    // Check if meal plan already exists for this week FIRST
    const { data: existingPlan } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('week_of', weekOf)
      .single()

    if (existingPlan) {
      return {
        conflict: true,
        existingPlanId: existingPlan.id,
        weekOf,
        error: 'A meal plan already exists for this week.'
      }
    }

    // Get user's survey responses
    const { data: userData } = await supabase
      .from('users')
      .select('survey_response')
      .eq('user_id', user.id)
      .single()

    if (!userData?.survey_response) {
      return {
        error: 'Please complete the onboarding survey first',
        needsSurvey: true
      }
    }

    // Calculate total meals
    const totalMeals = mealSelection.breakfast + mealSelection.lunch + mealSelection.dinner

    // Create meal plan record with 'generating' status
    // Include meal selection and schedule in the survey snapshot for reference
    const extendedSnapshot = {
      ...userData.survey_response,
      meal_selection: mealSelection,
      meal_schedule: mealSchedule || []
    }

    const { data: mealPlan, error: mealPlanError } = await supabase
      .from('meal_plans')
      .insert({
        user_id: user.id,
        week_of: weekOf,
        status: 'generating',
        total_meals: totalMeals,
        survey_snapshot: extendedSnapshot,
        generation_method: 'ai-generated',
        ai_model: 'gpt-4o'
      })
      .select()
      .single()

    if (mealPlanError) {
      console.error('Error creating meal plan:', mealPlanError)
      return { error: `Failed to create meal plan: ${mealPlanError.message}` }
    }

    // Return meal plan ID immediately for streaming
    return {
      success: true,
      mealPlanId: mealPlan.id,
      totalMeals,
      mealSelection
    }

  } catch (error: any) {
    console.error('Meal plan generation error:', error)
    return {
      error: error?.message || 'Failed to generate meal plan'
    }
  }
}

export async function replaceExistingMealPlan(
  existingPlanId: string,
  weekOf: string,
  mealSelection: MealSelection,
  mealSchedule?: MealScheduleEntry[]
) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: 'User not authenticated' }
    }

    // Verify the existing plan belongs to this user
    const { data: existingPlan } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('id', existingPlanId)
      .eq('user_id', user.id)
      .single()

    if (!existingPlan) {
      return { error: 'Meal plan not found or does not belong to you' }
    }

    // Delete the existing meal plan (cascade will handle recipes and grocery items)
    const { error: deleteError } = await supabase
      .from('meal_plans')
      .delete()
      .eq('id', existingPlanId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting existing meal plan:', deleteError)
      return { error: 'Failed to delete existing meal plan' }
    }

    // Now call the generate function to create the new meal plan
    const result = await generateMealPlanFromPreferences(weekOf, mealSelection, mealSchedule)
    
    // Add replaced flag if successful
    if (result.success) {
      return { ...result, replaced: true }
    }
    
    return result

  } catch (error: any) {
    console.error('Meal plan replacement error:', error)
    return {
      error: error?.message || 'Failed to replace meal plan'
    }
  }
}


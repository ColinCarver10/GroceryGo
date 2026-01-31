'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { validateIngredients } from '@/config/ingredients'
import { getPostHogClient } from '@/lib/posthog-server';
import { logDatabaseError, logAuthError } from '@/utils/errorLogger';

export async function saveSurveyResponse(surveyData: Record<string, string | string[]>) {
  const supabase = await createClient()

  // Get the current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    logAuthError('saveSurveyResponse', authError || new Error('User not found'), {
      operation: 'getUser',
      authErrorType: authError ? 'auth_error' : 'user_not_found'
    })
    return { success: false, error: 'User not authenticated' }
  }

  // Map question '12' (Foods You Like) to favored_ingredients
  // Map question '13' (Foods You Dislike) to excluded_ingredients
  const likedFoods = surveyData['12'] as string[] || []
  const dislikedFoods = surveyData['13'] as string[] || []

  // Validate ingredients server-side to ensure only predefined ingredients are saved
  const validatedLikedFoods = validateIngredients(likedFoods)
  const validatedDislikedFoods = validateIngredients(dislikedFoods)

  // Prepare the final survey data with validated ingredients
  const finalSurveyData = {
    ...surveyData,
    '12': validatedLikedFoods,
    '13': validatedDislikedFoods,
    favored_ingredients: validatedLikedFoods,
    excluded_ingredients: validatedDislikedFoods,
  }

  // Update the user's survey_response in the users table
  const { error: updateError } = await supabase
    .from('users')
    .update({ survey_response: finalSurveyData })
    .eq('user_id', user.id)

  if (updateError) {
    logDatabaseError('saveSurveyResponse', updateError, {
      table: 'users',
      operation: 'UPDATE',
      queryParams: { user_id: user.id }
    }, user.id)
    return { success: false, error: 'Failed to save survey response' }
  }

  // Track onboarding completion
  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: user.id,
    event: 'onboarding_completed',
    properties: {
      email: user.email,
      dietary_restrictions: surveyData['5'] || [],
      cuisine_preferences: surveyData['6'] || [],
      cooking_skill_level: surveyData['4'] || '',
      budget: surveyData['3'] || '',
      household_size: surveyData['1'] || '',
      liked_ingredients_count: validatedLikedFoods.length,
      disliked_ingredients_count: validatedDislikedFoods.length
    }
  });
  posthog.identify({
    distinctId: user.id,
    properties: {
      email: user.email,
      has_completed_onboarding: true,
      household_size: surveyData['1'] || '',
      cooking_skill_level: surveyData['4'] || ''
    }
  });

  // Invalidate dashboard cache to show updated preferences
  revalidateTag('dashboard')
  revalidatePath('/', 'layout')
  revalidatePath('/dashboard')

  return { success: true }
}


'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { validateIngredients } from '@/config/ingredients'

export async function saveSurveyResponse(surveyData: Record<string, string | string[]>) {
  const supabase = await createClient()

  // Get the current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error('Error getting user:', authError)
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
    console.error('Error saving survey response:', updateError)
    return { success: false, error: 'Failed to save survey response' }
  }

  // Invalidate dashboard cache to show updated preferences
  revalidateTag('dashboard')
  revalidatePath('/', 'layout')
  revalidatePath('/dashboard')
  
  return { success: true }
}


'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'

export async function saveSurveyResponse(surveyData: Record<number, string | string[]>) {
  const supabase = await createClient()

  // Get the current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error('Error getting user:', authError)
    return { success: false, error: 'User not authenticated' }
  }

  // Update the user's survey_response in the users table
  const { error: updateError } = await supabase
    .from('users')
    .update({ survey_response: surveyData })
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


import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import MealPlanGenerateClient from './MealPlanGenerateClient'

export default async function MealPlanGeneratePage() {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login')
  }

  // Check if user has completed the questionnaire
  const { data: userData } = await supabase
    .from('users')
    .select('survey_response')
    .eq('user_id', user.id)
    .single()

  if (!userData?.survey_response) {
    redirect('/onboarding')
  }

  return <MealPlanGenerateClient surveyResponse={userData.survey_response} />
}

import { redirect } from 'next/navigation'
import { getCachedUser, getCachedSurveyResponse } from '@/utils/supabase/server'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCachedUser()
  if (user) {
    const surveyResponse = await getCachedSurveyResponse(user.id)
    if (surveyResponse) {
      redirect('/dashboard')
    }
  }
  return <>{children}</>
}

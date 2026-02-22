import Link from 'next/link'
import { getCachedUser, getCachedSurveyResponse } from '@/utils/supabase/server'

export default async function HomeCtaLink() {
  const user = await getCachedUser()
  const href =
    user && (await getCachedSurveyResponse(user.id)) ? '/dashboard' : '/onboarding'
  return (
    <Link href={href} className="gg-btn-primary">
      Get Started
    </Link>
  )
}

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import { getUserDashboardData } from './actions'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login')
  }

  // Fetch dashboard data
  const dashboardData = await getUserDashboardData(user.id)

  // Pass data to client component
  return (
    <DashboardClient 
      surveyResponse={dashboardData.surveyResponse}
      mealPlans={dashboardData.mealPlans}
    />
  )
}

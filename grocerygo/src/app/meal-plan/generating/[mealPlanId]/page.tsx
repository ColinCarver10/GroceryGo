import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import GeneratingView from './GeneratingView'

export default async function GeneratingMealPlanPage({ 
  params 
}: { 
  params: Promise<{ mealPlanId: string }> 
}) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login')
  }

  // Await params
  const { mealPlanId } = await params

  // Fetch meal plan
  const { data: mealPlan, error: mealPlanError } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', mealPlanId)
    .eq('user_id', user.id)
    .single()

  if (mealPlanError || !mealPlan) {
    notFound()
  }

  // If meal plan is not in 'generating' status, redirect to view
  if (mealPlan.status !== 'generating') {
    redirect(`/meal-plan/${mealPlanId}`)
  }

  return (
    <GeneratingView 
      mealPlanId={mealPlanId}
      weekOf={mealPlan.week_of}
      totalMeals={mealPlan.total_meals}
      surveySnapshot={mealPlan.survey_snapshot}
    />
  )
}


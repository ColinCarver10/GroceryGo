import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import MealPlanView from './MealPlanView'
import { getMealPlanById } from '@/app/actions/mealPlans'

export default async function MealPlanDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login')
  }

  // Fetch meal plan with all details
  const mealPlan = await getMealPlanById(params.id, user.id)

  if (!mealPlan) {
    notFound()
  }

  return <MealPlanView mealPlan={mealPlan} />
}


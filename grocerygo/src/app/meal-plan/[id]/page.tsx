import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import MealPlanView from './MealPlanView'
import { getMealPlanById } from '@/app/actions/mealPlans'
import { getSavedRecipeIds } from '@/app/actions/userPreferences'

export default async function MealPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login')
  }

  // Await params before using its properties (Next.js 15+)
  const { id } = await params

  // Fetch meal plan with all details
  const mealPlan = await getMealPlanById(id, user.id)

  if (!mealPlan) {
    notFound()
  }

  // Fetch user's saved recipe IDs
  const savedRecipeIds = await getSavedRecipeIds(user.id)

  return <MealPlanView mealPlan={mealPlan} savedRecipeIds={savedRecipeIds} />
}


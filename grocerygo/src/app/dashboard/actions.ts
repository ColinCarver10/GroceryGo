'use server'

import { createClient } from '@/utils/supabase/server'
import { unstable_cache } from 'next/cache'
import { revalidateTag } from 'next/cache'
import type { MealPlanWithRecipes } from '@/types/database'

export async function getUserDashboardData(userId: string, page: number = 1, pageSize: number = 5) {
  const supabase = await createClient()
  
  // Calculate offset for pagination
  const offset = (page - 1) * pageSize
  
  // Fetch user data with survey responses
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('survey_response, email')
    .eq('user_id', userId)
    .single()

  if (userError) {
    console.error('Error fetching user data:', userError)
  }

  // Get total count of meal plans
  const { count: totalCount, error: countError } = await supabase
    .from('meal_plans')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (countError) {
    console.error('Error fetching meal plans count:', countError)
  }

  // Fetch meal plans with recipes and grocery items
  const { data: mealPlans, error: plansError } = await supabase
    .from('meal_plans')
    .select(`
      *,
      meal_plan_recipes (
        *,
        recipe:full_recipes_table (*)
      ),
      grocery_items (*)
    `)
    .eq('user_id', userId)
    .order('week_of', { ascending: false })
    .range(offset, offset + pageSize - 1)
  
  if (plansError) {
    console.error('Error fetching meal plans:', plansError)
  }

  // Fetch saved recipes with full recipe details
  const { data: savedRecipes, error: savedError } = await supabase
    .from('saved_recipes')
    .select(`
      *,
      recipe:recipes (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (savedError) {
    console.error('Error fetching saved recipes:', savedError)
  }

  // Calculate total meals across all meal plans
  const { data: allPlansForStats, error: statsError } = await supabase
    .from('meal_plans')
    .select('total_meals, created_at')
    .eq('user_id', userId)

  if (statsError) {
    console.error('Error fetching meal plan stats:', statsError)
  }

  const totalMealsPlanned = allPlansForStats?.reduce((sum, plan) => sum + plan.total_meals, 0) || 0
  const now = new Date()
  const plansThisMonth = allPlansForStats?.filter(plan => {
    const planDate = new Date(plan.created_at)
    return planDate.getMonth() === now.getMonth() && planDate.getFullYear() === now.getFullYear()
  }).length || 0

  return {
    surveyResponse: userData?.survey_response || null,
    email: userData?.email || '',
    mealPlans: (mealPlans as MealPlanWithRecipes[]) || [],
    savedRecipes: savedRecipes || [],
    totalMealPlans: totalCount || 0,
    totalMealsPlanned,
    plansThisMonth,
    currentPage: page,
    pageSize
  }
}

// Cached version with 60 second revalidation
export const getCachedDashboardData = unstable_cache(
  getUserDashboardData,
  ['user-dashboard'],
  { 
    revalidate: 60,
    tags: ['dashboard']
  }
)

// Function to invalidate dashboard cache after updates
export async function invalidateDashboardCache() {
  revalidateTag('dashboard')
}

// Fetch paginated meal plans for client-side pagination
export async function getPaginatedMealPlans(page: number = 1, pageSize: number = 5) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { success: false, error: 'Not authenticated', mealPlans: [], totalMealPlans: 0, currentPage: page, pageSize }
  }

  const result = await getUserDashboardData(user.id, page, pageSize)
  
  return {
    success: true,
    mealPlans: result.mealPlans,
    totalMealPlans: result.totalMealPlans,
    currentPage: result.currentPage,
    pageSize: result.pageSize
  }
}

// Update individual survey response
export async function updateSurveyResponse(questionId: string, answer: string | string[]) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get current survey response
  const { data: userData, error: fetchError } = await supabase
    .from('users')
    .select('survey_response')
    .eq('user_id', user.id)
    .single()

  if (fetchError) {
    console.error('Error fetching current survey:', fetchError)
    return { success: false, error: 'Failed to fetch current preferences' }
  }

  // Update the specific question
  const updatedSurvey = {
    ...(userData.survey_response || {}),
    [questionId]: answer
  }

  // Save back to database
  const { error: updateError } = await supabase
    .from('users')
    .update({ survey_response: updatedSurvey })
    .eq('user_id', user.id)

  if (updateError) {
    console.error('Error updating survey response:', updateError)
    return { success: false, error: 'Failed to update preference' }
  }

  // Invalidate cache
  invalidateDashboardCache()

  return { success: true }
}


'use server'

import { createClient } from '@/utils/supabase/server'
import { unstable_cache } from 'next/cache'
import { revalidateTag } from 'next/cache'
import type { MealPlanWithRecipes } from '@/types/database'

/**
 * Check if recipes already exist for a meal plan
 * Returns true if meal_plan_recipes exist, indicating generation is complete
 */
export async function checkMealPlanRecipesExist(mealPlanId: string): Promise<boolean> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('meal_plan_recipes')
    .select('id')
    .eq('meal_plan_id', mealPlanId)
    .limit(1)
  
  if (error) {
    console.error('Error checking meal plan recipes:', error)
    return false
  }
  
  return (data?.length ?? 0) > 0
}

/**
 * Update meal plan statuses based on current date
 * - Pending plans within date range -> in-progress
 * - In-progress plans with past end date -> completed
 */
export async function updateMealPlanStatuses(userId: string): Promise<number> {
  const supabase = await createClient()
  
  // Get current date (local timezone, set to midnight for date-only comparison)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Fetch all meal plans with status 'pending' or 'in-progress'
  const { data: mealPlans, error: fetchError } = await supabase
    .from('meal_plans')
    .select('id, week_of, status')
    .eq('user_id', userId)
    .in('status', ['pending', 'in-progress'])
  
  if (fetchError) {
    console.error('Error fetching meal plans for status update:', fetchError)
    return 0
  }
  
  if (!mealPlans || mealPlans.length === 0) {
    return 0
  }
  
  let updatedCount = 0
  
  // Process each meal plan
  for (const plan of mealPlans) {
    // Parse the date string to avoid timezone issues
    const [year, month, day] = plan.week_of.split('-').map(Number)
    const startDate = new Date(year, month - 1, day)
    
    // Calculate end date (6 days after start, so 7 days total)
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6)
    
    // Set dates to midnight for date-only comparison
    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(0, 0, 0, 0)
    
    let newStatus: 'in-progress' | 'completed' | null = null
    
    if (plan.status === 'pending') {
      // If current date is within range, update to in-progress
      if (today >= startDate && today <= endDate) {
        newStatus = 'in-progress'
      }
    } else if (plan.status === 'in-progress') {
      // If end date is in the past, update to completed
      if (endDate < today) {
        newStatus = 'completed'
      }
    }
    
    // Update status if needed
    if (newStatus) {
      const { error: updateError } = await supabase
        .from('meal_plans')
        .update({ status: newStatus })
        .eq('id', plan.id)
        .eq('user_id', userId)
      
      if (updateError) {
        console.error(`Error updating meal plan ${plan.id} status:`, updateError)
      } else {
        updatedCount++
      }
    }
  }
  
  return updatedCount
}

export async function getUserDashboardData(userId: string, page: number = 1, pageSize: number = 5) {
  const supabase = await createClient()
  
  // Update meal plan statuses before fetching data
  await updateMealPlanStatuses(userId)
  
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
        updated_recipe:recipes (*)
      ),
      grocery_items (*)
    `)
    .eq('user_id', userId)
    .order('week_of', { ascending: false })
    .range(offset, offset + pageSize - 1)
  
  if (plansError) {
    console.error('Error fetching meal plans:', plansError)
  }

  // Fetch parent recipes separately for meal_plan_recipes that don't have updated_recipe_id
  const mealPlanRecipes = (mealPlans || []).flatMap((plan: any) => plan.meal_plan_recipes || [])
  const parentRecipeIds = mealPlanRecipes
    .filter((mpr: any) => !mpr.updated_recipe_id && mpr.recipe_id)
    .map((mpr: any) => mpr.recipe_id)
    .filter((id: any, index: number, arr: any[]) => arr.indexOf(id) === index) // unique

  let parentRecipesMap = new Map()
  if (parentRecipeIds.length > 0) {
    const { data: parentRecipes } = await supabase
      .from('full_recipes_table')
      .select('recipe_id, name, nutrition, steps, description, ingredients, meal_type')
      .in('recipe_id', parentRecipeIds)

    if (parentRecipes) {
      parentRecipes.forEach((pr: any) => {
        parentRecipesMap.set(pr.recipe_id, pr)
      })
    }
  }

  // Transform data to use updated_recipe if available, fallback to parent_recipe
  const transformedMealPlans = (mealPlans || []).map((plan: any) => ({
    ...plan,
    meal_plan_recipes: (plan.meal_plan_recipes || []).map((mpr: any) => ({
      ...mpr,
      recipe: mpr.updated_recipe || parentRecipesMap.get(mpr.recipe_id) || null
    }))
  }))

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
    mealPlans: (transformedMealPlans as MealPlanWithRecipes[]) || [],
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


import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import MealPlanView from './MealPlanView'
import { getMealPlanById } from '@/app/actions/mealPlans'
import { getSavedRecipeIds } from '@/app/actions/userPreferences'
import { updateMealPlanStatuses } from '@/app/dashboard/actions'
import { getMealPlanFeedback } from '@/app/actions/feedbackHelper'
import type { Metadata } from 'next'

function formatMealPlanDateRange(weekOf: string): string {
  if (!weekOf) return ''
  
  // Parse the start date from week_of (format: YYYY-MM-DD)
  const parts = weekOf.split('-')
  if (parts.length !== 3) return weekOf // Fallback if format is unexpected
  
  const [year, month, day] = parts.map(Number)
  if (isNaN(year) || isNaN(month) || isNaN(day)) return weekOf // Fallback if parsing fails
  
  const startDate = new Date(year, month - 1, day)
  
  // Validate date
  if (isNaN(startDate.getTime())) return weekOf // Fallback if invalid date
  
  // Calculate end date (7 days after start)
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6) // +6 because we want 7 days total (start + 6 more)
  
  // If same month, simplify: "January 25 - 31"
  if (startDate.getMonth() === endDate.getMonth()) {
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'long' })
    const startDay = startDate.getDate()
    const endDay = endDate.getDate()
    return `${startMonth} ${startDay} - ${endDay}`
  }
  
  // Different months: "December 26 - January 1"
  const startFormatted = startDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  })
  
  const endFormatted = endDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  })
  
  return `${startFormatted} - ${endFormatted}`
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return {
      title: 'Meal Plan - GroceryGo'
    }
  }

  const { id } = await params
  const mealPlan = await getMealPlanById(id, user.id)

  if (!mealPlan) {
    return {
      title: 'Meal Plan - GroceryGo'
    }
  }

  const dateRange = formatMealPlanDateRange(mealPlan.week_of)
  return {
    title: `Meal Plan for ${dateRange} - GroceryGo`
  }
}

export default async function MealPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login')
  }

  // Await params before using its properties (Next.js 15+)
  const { id } = await params

  // Update meal plan statuses before fetching data
  await updateMealPlanStatuses(user.id)

  // Fetch meal plan with all details
  const mealPlan = await getMealPlanById(id, user.id)

  if (!mealPlan) {
    notFound()
  }

  // Handle backward compatibility: convert old array format to new structure
  let totalIngredients: { items: Array<{ item: string; quantity: string }>; seasonings: Array<{ item: string; quantity: string }> }
  if (!mealPlan.total_ingredients) {
    totalIngredients = { items: [], seasonings: [] }
  } else if (Array.isArray(mealPlan.total_ingredients)) {
    // Old format: convert to new structure
    totalIngredients = {
      items: mealPlan.total_ingredients,
      seasonings: []
    }
  } else if (typeof mealPlan.total_ingredients === 'object' && ('items' in mealPlan.total_ingredients || 'seasonings' in mealPlan.total_ingredients)) {
    // New format: use as-is
    totalIngredients = {
      items: (mealPlan.total_ingredients as any).items || [],
      seasonings: (mealPlan.total_ingredients as any).seasonings || []
    }
  } else {
    totalIngredients = { items: [], seasonings: [] }
  }

  // Fetch user's saved recipe IDs
  const savedRecipeIds = await getSavedRecipeIds(user.id)

  // Fetch existing feedback for this meal plan
  const existingFeedback = await getMealPlanFeedback(id, user.id)

  return <MealPlanView mealPlan={mealPlan} savedRecipeIds={savedRecipeIds} totalIngredients={totalIngredients} existingFeedback={existingFeedback} />
}


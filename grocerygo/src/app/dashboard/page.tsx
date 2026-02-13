import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getUserCoreData, updateMealPlanStatuses } from './actions'
import MealPlansSection from './MealPlansSection'
import SavedRecipesSection from './SavedRecipesSection'
import QuickStatsSection from './QuickStatsSection'
import PreferencesClient from './PreferencesClient'
import WalkthroughWrapper from './WalkthroughWrapper'
import MealPlansSkeleton from '@/components/MealPlansSkeleton'
import SavedRecipesSkeleton from '@/components/SavedRecipesSkeleton'
import QuickStatsSkeleton from '@/components/QuickStatsSkeleton'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login')
  }

  // Fast core data fetch (single query, blocks render for redirect check)
  const coreData = await getUserCoreData(user.id)

  // Redirect to onboarding if user hasn't completed questionnaire
  if (!coreData.surveyResponse) {
    redirect('/onboarding')
  }

  // Fire and forget -- update statuses without blocking render
  void updateMealPlanStatuses(user.id)

  return (
    <div className="gg-bg-page min-h-screen">
      <div className="gg-container">
        <div className="gg-section">
          
          {/* Header -- renders instantly */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="gg-heading-page mb-2">My Dashboard</h1>
              <p className="gg-text-subtitle">Manage your meal plans and preferences</p>
            </div>
            <Link href="/meal-plan-generate" className="w-full sm:w-auto">
              <button className="gg-btn-primary gap-2 w-full sm:w-auto justify-center">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Generate New Meal Plan</span>
                <span className="sm:hidden">New Meal Plan</span>
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            
            {/* Main Content */}
            <div className="lg:col-span-2">
              <Suspense fallback={<MealPlansSkeleton />}>
                <MealPlansSection userId={user.id} />
              </Suspense>

              <Suspense fallback={<SavedRecipesSkeleton />}>
                <SavedRecipesSection userId={user.id} />
              </Suspense>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Preferences render instantly from core data */}
              <PreferencesClient surveyResponse={coreData.surveyResponse} />

              <Suspense fallback={<QuickStatsSkeleton />}>
                <QuickStatsSection userId={user.id} />
              </Suspense>
            </div>

          </div>

          {/* Onboarding Walkthrough (renders instantly from core data) */}
          {coreData.firstLoginFlag && (
            <WalkthroughWrapper />
          )}
        </div>
      </div>
    </div>
  )
}

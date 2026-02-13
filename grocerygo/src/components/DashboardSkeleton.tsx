import Link from 'next/link'
import MealPlansSkeleton from './MealPlansSkeleton'
import SavedRecipesSkeleton from './SavedRecipesSkeleton'
import QuickStatsSkeleton from './QuickStatsSkeleton'

export default function DashboardSkeleton() {
  return (
    <div className="gg-bg-page min-h-screen">
      <div className="gg-container">
        <div className="gg-section">
          
          {/* Header - Static */}
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
              <MealPlansSkeleton />
              <SavedRecipesSkeleton />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              
              {/* Survey Responses Card - Static Header */}
              <div className="gg-card">
                <button className="flex w-full items-center justify-between" disabled>
                  <h2 className="gg-heading-section">My Preferences</h2>
                  <svg 
                    className="h-5 w-5 text-gray-600"
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              <QuickStatsSkeleton />
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

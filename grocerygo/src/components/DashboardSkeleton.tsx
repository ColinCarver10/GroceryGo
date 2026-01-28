import MealPlanCardSkeleton from './MealPlanCardSkeleton'
import Link from 'next/link'

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
            
            {/* Main Content - Meal Plans */}
            <div className="lg:col-span-2">
              <div className="gg-card">
                <h2 className="gg-heading-section mb-6">Previous Meal Plans</h2>
                
                {/* Meal Plan Cards Skeleton - Only the data */}
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <MealPlanCardSkeleton key={i} />
                  ))}
                </div>
                
                {/* Pagination Skeleton */}
                <div className="mt-6 flex justify-center gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 w-10 bg-gray-200 rounded animate-pulse"></div>
                  ))}
                </div>
              </div>

              {/* Saved Recipes Section - Static Header */}
              <div className="gg-card mt-8">
                <button className="flex w-full items-center justify-between gap-2" disabled>
                  <h2 className="gg-heading-section flex items-center gap-2 text-lg sm:text-2xl">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--gg-primary)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span className="hidden sm:inline">Saved Recipes</span>
                    <span className="sm:hidden">Saved</span>
                  </h2>
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

              {/* Quick Stats Card - Static Header, Skeleton for Data */}
              <div className="gg-card">
                <h2 className="gg-heading-section mb-6">Quick Stats</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="gg-text-body text-sm">Total Meal Plans</span>
                    <div className="h-8 bg-gray-200 rounded w-12 animate-pulse"></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="gg-text-body text-sm">Total Meals Planned</span>
                    <div className="h-8 bg-gray-200 rounded w-12 animate-pulse"></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="gg-text-body text-sm">Saved Recipes</span>
                    <div className="h-8 bg-gray-200 rounded w-12 animate-pulse"></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="gg-text-body text-sm">This Month</span>
                    <div className="h-8 bg-gray-200 rounded w-12 animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

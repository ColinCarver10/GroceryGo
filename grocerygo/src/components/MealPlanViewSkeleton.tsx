import MealColumnSkeleton from './MealColumnSkeleton'
import ShoppingListItemSkeleton from './ShoppingListItemSkeleton'
import Link from 'next/link'

export default function MealPlanViewSkeleton() {
  return (
    <div className="gg-bg-page min-h-screen">
      <div className="gg-container">
        <div className="gg-section">
          
          {/* Header - Static */}
          <div className="mb-6 sm:mb-8">
            {/* Back link - Static */}
            <Link 
              href="/dashboard" 
              className="gg-text-body text-sm mb-4 inline-flex items-center gap-2 hover:text-[var(--gg-primary)] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Link>
            
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                {/* Title skeleton - data is fetched */}
                <div className="h-8 sm:h-10 lg:h-12 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
                {/* Subtitle skeleton - data is fetched */}
                <div className="h-5 sm:h-6 bg-gray-200 rounded w-full sm:w-2/3 animate-pulse"></div>
              </div>
              <div className="flex items-center sm:flex-col sm:items-end gap-2 sm:gap-3">
                {/* Status badge skeleton - data is fetched */}
                <div className="h-6 bg-gray-200 rounded-full w-24 animate-pulse"></div>
                {/* Feedback component skeleton - data is fetched */}
                <div className="h-10 w-10 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Tabs - Static with placeholder counts */}
          <div className="mb-6 border-b border-gray-200">
            <div className="flex gap-4 sm:gap-8">
              <button
                disabled
                className="pb-3 sm:pb-4 px-1 border-b-2 border-[var(--gg-primary)] font-semibold text-sm sm:text-base text-[var(--gg-primary)]"
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="hidden sm:inline">Recipes</span>
                  <span className="sm:hidden">Recipes</span>
                  <span className="text-xs sm:text-sm">(0)</span>
                </span>
              </button>
              <button
                disabled
                className="pb-3 sm:pb-4 px-1 border-b-2 border-transparent font-semibold text-sm sm:text-base text-gray-600"
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="hidden sm:inline">Shopping List</span>
                  <span className="sm:hidden">Shopping</span>
                  <span className="text-xs sm:text-sm">(0)</span>
                </span>
              </button>
            </div>
          </div>

          {/* Content Skeleton - Recipes Tab */}
          <div className="space-y-6">
            {/* Weekly Schedule Layout Skeleton */}
            <div className="space-y-4">
              {/* Header Row - Static */}
              <div className="hidden lg:grid lg:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 justify-center">
                  <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="font-semibold text-yellow-900 uppercase text-sm tracking-wider">Breakfast</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-orange-900 uppercase text-sm tracking-wider">Lunch</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <span className="font-semibold text-blue-900 uppercase text-sm tracking-wider">Dinner</span>
                </div>
              </div>

              {/* Day Rows Skeleton */}
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <div key={day} className="space-y-3">
                  {/* Day Header - Skeleton for fetched data */}
                  <div className="text-left">
                    <div className="h-6 sm:h-7 bg-gray-200 rounded w-32 mb-2 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-40 animate-pulse"></div>
                  </div>

                  {/* Mobile/Tablet: Stack vertically */}
                  <div className="lg:hidden space-y-3">
                    <MealColumnSkeleton showMobileHeader={true} mealCount={1} mealType="breakfast" />
                    <MealColumnSkeleton showMobileHeader={true} mealCount={1} mealType="lunch" />
                    <MealColumnSkeleton showMobileHeader={true} mealCount={1} mealType="dinner" />
                  </div>

                  {/* Desktop: Horizontal grid */}
                  <div className="hidden lg:grid lg:grid-cols-3 gap-4">
                    <MealColumnSkeleton showMobileHeader={false} minHeight="min-h-[200px]" mealCount={1} mealType="breakfast" />
                    <MealColumnSkeleton showMobileHeader={false} minHeight="min-h-[200px]" mealCount={1} mealType="lunch" />
                    <MealColumnSkeleton showMobileHeader={false} minHeight="min-h-[200px]" mealCount={1} mealType="dinner" />
                  </div>
                </div>
              ))}
            </div>

            {/* Unscheduled Meals Section - Static Header */}
            <div className="gg-card border-2 border-gray-200">
              <h3 className="gg-heading-section mb-6">Unscheduled Meals</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-xl border-2 border-gray-200 bg-white p-4 animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Shopping List Tab Skeleton (hidden by default) */}
          <div className="hidden grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {/* Mobile Instacart button - Static */}
              <div className="gg-card mb-4 lg:hidden">
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 cursor-not-allowed opacity-50"
                  style={{
                    height: '46px',
                    paddingTop: '16px',
                    paddingBottom: '16px',
                    paddingLeft: '18px',
                    paddingRight: '18px',
                    backgroundColor: '#003D29',
                    color: '#FAF1E5',
                  }}
                >
                  <div className="h-5 w-5 bg-white/20 rounded"></div>
                  Get Recipe Ingredients
                </button>
              </div>

              <div className="gg-card">
                <h2 className="gg-heading-section mb-4">Shopping List</h2>
                
                {/* Description - Static */}
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-700 mb-2">
                    <strong>How it works:</strong> <span className="hidden sm:inline">Click anywhere on an item to check it off your list. Use the menu (⋮) to exclude ingredients from future meal plans or mark them as favorites.</span><span className="sm:hidden">Tap items to check off. Use ⋮ menu for more options.</span>
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">
                    Items are automatically consolidated from all recipes in your meal plan. Checked items are excluded when ordering from Instacart.
                  </p>
                </div>
                
                {/* Shopping list items skeleton - Only the data */}
                <div className="space-y-2 mb-8">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <ShoppingListItemSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar - Static */}
            <div className="space-y-6">
              {/* Desktop Instacart button - Static */}
              <div className="gg-card hidden lg:block">
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 cursor-not-allowed opacity-50"
                  style={{
                    height: '46px',
                    paddingTop: '16px',
                    paddingBottom: '16px',
                    paddingLeft: '18px',
                    paddingRight: '18px',
                    backgroundColor: '#003D29',
                    color: '#FAF1E5',
                  }}
                >
                  <div className="h-5 w-5 bg-white/20 rounded"></div>
                  Get Recipe Ingredients
                </button>
              </div>

              {/* Copy to clipboard - Static */}
              <div className="gg-card">
                <button
                  disabled
                  className="gg-btn-outline w-full opacity-50 cursor-not-allowed"
                >
                  Copy to Clipboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

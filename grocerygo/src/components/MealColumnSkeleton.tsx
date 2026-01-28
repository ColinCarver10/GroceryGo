import MealSlotCardSkeleton from './MealSlotCardSkeleton'

interface MealColumnSkeletonProps {
  showMobileHeader?: boolean
  minHeight?: string
  mealCount?: number
  mealType?: 'breakfast' | 'lunch' | 'dinner'
}

export default function MealColumnSkeleton({ 
  showMobileHeader = false, 
  minHeight = 'min-h-[200px]',
  mealCount = 2,
  mealType = 'breakfast'
}: MealColumnSkeletonProps) {
  const mealTypeLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1)
  
  const mealTypeConfig = {
    breakfast: {
      colorClasses: {
        text: 'text-yellow-900',
        icon: 'text-yellow-600',
      },
      icon: (
        <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
    lunch: {
      colorClasses: {
        text: 'text-orange-900',
        icon: 'text-orange-600',
      },
      icon: (
        <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    dinner: {
      colorClasses: {
        text: 'text-blue-900',
        icon: 'text-blue-600',
      },
      icon: (
        <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )
    }
  }
  
  const config = mealTypeConfig[mealType]
  
  return (
    <>
      {/* Mobile header - Static */}
      {showMobileHeader && (
        <div className="lg:hidden">
          <div className="flex items-center gap-2 mb-2 px-2">
            {config.icon}
            <h4 className={`text-sm font-bold ${config.colorClasses.text} uppercase tracking-wider`}>
              {mealTypeLabel}
            </h4>
          </div>
        </div>
      )}
      
      {/* Meal column container skeleton - Only the meal cards */}
      <div className={`bg-gradient-to-br from-gray-50 to-gray-100/50 border-2 border-gray-200 rounded-lg p-4 ${minHeight} flex flex-col`}>
        <div className="space-y-3 flex-1">
          {Array.from({ length: mealCount }).map((_, i) => (
            <MealSlotCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </>
  )
}

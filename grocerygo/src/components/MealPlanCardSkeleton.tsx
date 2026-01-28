export default function MealPlanCardSkeleton() {
  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title and status badge */}
          <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="h-6 sm:h-7 bg-gray-200 rounded w-44 animate-pulse"></div>
            <div className="h-6 bg-gray-200 rounded-full w-20 sm:w-24 animate-pulse"></div>
          </div>
          
          {/* Date and meals info */}
          <div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1">
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
            </div>
          </div>

          {/* Click to view text */}
          <div className="h-4 bg-gray-200 rounded w-40 sm:w-56 animate-pulse"></div>
        </div>

        {/* Arrow icon */}
        <div className="h-5 w-5 sm:h-6 sm:w-6 bg-gray-200 rounded animate-pulse flex-shrink-0"></div>
      </div>
    </div>
  )
}

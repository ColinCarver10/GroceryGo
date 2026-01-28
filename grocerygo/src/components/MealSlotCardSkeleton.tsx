export default function MealSlotCardSkeleton() {
  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-3 sm:p-4 md:p-6 animate-pulse">
      <div className="flex items-start justify-between mb-2 sm:mb-3 md:mb-4">
        <div className="h-5 sm:h-6 md:h-7 bg-gray-200 rounded w-3/4"></div>
        <div className="h-6 bg-gray-200 rounded-full w-16 sm:w-20"></div>
      </div>

      <div className="mb-2 sm:mb-3 md:mb-4 flex flex-wrap gap-2 sm:gap-3">
        <div className="h-4 bg-gray-200 rounded w-16"></div>
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </div>

      <div className="mb-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        <div className="h-3 bg-gray-200 rounded w-4/5"></div>
      </div>

      <div className="flex items-center justify-between mt-auto">
        <div className="h-8 bg-gray-200 rounded w-24"></div>
        <div className="h-8 w-8 bg-gray-200 rounded"></div>
      </div>
    </div>
  )
}

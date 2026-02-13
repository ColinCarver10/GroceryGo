import MealPlanCardSkeleton from './MealPlanCardSkeleton'

export default function MealPlansSkeleton() {
  return (
    <div className="gg-card">
      <h2 className="gg-heading-section mb-6">Previous Meal Plans</h2>
      
      {/* Meal Plan Cards Skeleton */}
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
  )
}

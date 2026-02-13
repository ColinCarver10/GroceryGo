export default function QuickStatsSkeleton() {
  return (
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
  )
}

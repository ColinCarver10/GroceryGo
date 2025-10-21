export default function RecipeCardSkeleton() {
  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-6 animate-pulse">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>

      {/* Meta info */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="h-5 bg-gray-200 rounded w-16"></div>
        <div className="h-5 bg-gray-200 rounded w-20"></div>
        <div className="h-5 bg-gray-200 rounded w-24"></div>
      </div>

      {/* Ingredients */}
      <div className="mb-4">
        <div className="h-5 bg-gray-200 rounded w-32 mb-2"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-4/5"></div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <div className="h-10 bg-gray-200 rounded flex-1"></div>
        <div className="h-10 bg-gray-200 rounded w-10"></div>
      </div>
    </div>
  )
}


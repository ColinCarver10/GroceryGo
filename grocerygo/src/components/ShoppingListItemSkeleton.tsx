export default function ShoppingListItemSkeleton() {
  return (
    <div className="flex items-center gap-2 sm:gap-4 rounded-lg border-2 border-gray-200 bg-white p-3 sm:p-4 animate-pulse">
      <div className="h-5 w-5 sm:h-6 sm:w-6 bg-gray-200 rounded border-2 border-gray-200 flex-shrink-0"></div>
      
      <div className="flex-1">
        <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>

      <div className="h-8 w-8 bg-gray-200 rounded flex-shrink-0"></div>
    </div>
  )
}

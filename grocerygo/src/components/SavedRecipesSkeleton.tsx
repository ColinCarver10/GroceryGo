export default function SavedRecipesSkeleton() {
  return (
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
  )
}

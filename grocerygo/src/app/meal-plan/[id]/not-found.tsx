import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="gg-bg-page min-h-screen flex items-center justify-center">
      <div className="gg-container">
        <div className="max-w-md mx-auto text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          
          <h1 className="gg-heading-page mb-4">Meal Plan Not Found</h1>
          <p className="gg-text-body mb-8">
            Sorry, we couldn&apos;t find the meal plan you&apos;re looking for. 
            It may have been deleted or you don&apos;t have access to it.
          </p>
          
          <div className="flex gap-4 justify-center">
            <Link href="/dashboard">
              <button className="gg-btn-primary">
                Back to Dashboard
              </button>
            </Link>
            <Link href="/meal-plan-generate">
              <button className="gg-btn-outline">
                Create New Plan
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}


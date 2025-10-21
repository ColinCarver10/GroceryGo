import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="gg-bg-page min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Meal Plan Not Found</h2>
        <p className="text-gray-600 mb-8">
          The meal plan you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.
        </p>
        <Link href="/dashboard">
          <button className="gg-btn-primary">
            Return to Dashboard
          </button>
        </Link>
      </div>
    </div>
  )
}


'use client'

import Link from 'next/link'

export default function ErrorPage() {
  return (
    <div className="gg-bg-page min-h-screen">
      <div className="gg-container">
        <div className="flex min-h-screen flex-col items-center justify-center py-12 text-center">
          
          {/* Error Icon */}
          <div className="mb-6 text-6xl">⚠️</div>
          
          {/* Error Message */}
          <h1 className="gg-heading-hero mb-4">Oops! Something went wrong</h1>
          
          <p className="gg-text-subtitle mb-8 max-w-md">
            Don&apos;t worry, these things happen. Let&apos;s get you back on track.
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/" className="gg-btn-primary">
              Go Home
            </Link>
            <Link href="/login" className="gg-btn-outline">
              Try Logging In Again
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
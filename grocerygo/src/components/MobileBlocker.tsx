'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export default function MobileBlocker() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const checkMobile = () => {
      // Check user agent for mobile devices
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i
      const isMobileDevice = mobileRegex.test(userAgent)

      // Also check screen width as a secondary check
      const isSmallScreen = window.innerWidth < 768

      const mobile = isMobileDevice || isSmallScreen
      setIsMobile(mobile)

      // Redirect to home if mobile and not on home page
      if (mobile && pathname !== '/') {
        router.push('/')
      }
    }

    // Check on mount
    checkMobile()

    // Also check on resize (in case user resizes window)
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [pathname, router])

  // Show nothing while checking or if not mobile
  if (isMobile === null || !isMobile) {
    return null
  }

  // Only show overlay on home page
  if (pathname !== '/') {
    return null
  }

  // Show overlay on home page for mobile users
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black opacity-40 z-50" />
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <svg
            className="w-16 h-16 mx-auto text-gg-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gg-text mb-4">
          Mobile Version Coming Soon
        </h1>
        <p className="text-gg-text-sub mb-6 leading-relaxed">
          The mobile version is still a work in progress. Please join from a computer & check back soon for the mobile version.
        </p>
        <div className="text-sm text-gg-text-sub">
          We&apos;re working hard to bring you the best experience on mobile devices!
        </div>
        </div>
      </div>
    </>
  )
}


'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { login, signup } from '@/app/login/actions'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'

function LoginContent() {
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      setToastMessage(decodeURIComponent(error))
      setShowToast(true)
      
      // Clear the error from URL
      router.replace('/login')
      
      // Auto-hide toast after 5 seconds
      const timer = setTimeout(() => {
        setShowToast(false)
      }, 5000)
      
      return () => clearTimeout(timer)
    }
  }, [searchParams, router])

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setIsLoggedIn(true)
        setUserEmail(user.email || '')
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setIsLoggedIn(false)
    setUserEmail('')
  }

  return (
    <div className="gg-bg-page min-h-screen">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-in">
          <div className="bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 max-w-md">
            <svg className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="flex-1">{toastMessage}</p>
            <button 
              onClick={() => setShowToast(false)}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="gg-container">
        <div className="flex min-h-screen flex-col items-center justify-center py-12">
          
          {isLoading ? (
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--gg-primary)] border-r-transparent"></div>
            </div>
          ) : isLoggedIn ? (
            /* Already Logged In View */
            <>
              <div className="mb-8 text-center">
                <p className="gg-text-subtitle">You&apos;re already logged in!</p>
              </div>

              <div className="w-full max-w-md">
                <div className="gg-card">
                  <h2 className="gg-heading-section mb-6">Already Logged In</h2>
                  
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <span className="font-semibold">Logged in as: </span>
                      {userEmail}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Link href="/dashboard" className="gg-btn-primary w-full text-center">
                      Go to Dashboard
                    </Link>
                    <button 
                      onClick={handleLogout}
                      className="gg-btn-outline w-full"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Login Form */
            <>
              <div className="mb-8 text-center">
                <p className="gg-text-subtitle">Welcome back! Let&apos;s get cooking.</p>
              </div>

              <div className="w-full max-w-md">
                <form className="gg-card">
                  <h2 className="gg-heading-section mb-6">Sign In</h2>
                  
                  {/* Email Input */}
                  <div className="gg-form-group">
                    <label htmlFor="email" className="gg-label">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="gg-input"
                      placeholder="your@email.com"
                    />
                  </div>

                  {/* Password Input */}
                  <div className="gg-form-group mb-8">
                    <label htmlFor="password" className="gg-label">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      className="gg-input"
                      placeholder="••••••••"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3">
                    <button formAction={login} className="gg-btn-primary w-full">
                      Log In
                    </button>
                    <button formAction={signup} className="gg-btn-outline w-full">
                      Sign Up
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="gg-bg-page min-h-screen">
        <div className="gg-container">
          <div className="flex min-h-screen flex-col items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--gg-primary)] border-r-transparent"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
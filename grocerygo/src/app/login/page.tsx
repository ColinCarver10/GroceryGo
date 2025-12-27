'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { login, signup, signInWithGoogle } from '@/app/login/actions'
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

  const handleGoogleSignIn = async () => {
    await signInWithGoogle()
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
                  <div className="gg-form-group mb-6">
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

                  {/* Divider */}
                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">Or continue with</span>
                    </div>
                  </div>

                  {/* Google OAuth Button */}
                  <div className="mb-6">
                    <button 
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="gg-btn-outline w-full flex items-center justify-center gap-3"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Continue with Google
                    </button>
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
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import MobileNav from '@/components/MobileNav'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <nav className="border-b border-[var(--gg-border)] bg-white shadow-sm">
      <div className="gg-container">
        <div className="flex h-16 items-center justify-between">
          
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--gg-primary)] transition-opacity hover:opacity-80">
              GroceryGo
            </h1>
          </Link>

          {/* Desktop Navigation Links */}
          {user && (
            <div className="hidden md:flex items-center gap-6">
              <Link 
                href="/dashboard" 
                className="gg-text-body text-sm font-medium transition-colors hover:text-[var(--gg-primary)]"
              >
                Dashboard
              </Link>
              <Link 
                href="/meal-plan-generate" 
                className="gg-text-body text-sm font-medium transition-colors hover:text-[var(--gg-primary)]"
              >
                Generate Plan
              </Link>
            </div>
          )}

          {/* Right Side - User Profile or Login */}
          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <>
                {/* Desktop User Info */}
                <div className="hidden md:flex items-center gap-3">
                  {/* User Avatar */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--gg-primary)] text-white font-semibold">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  {/* User Email */}
                  <span className="hidden lg:block gg-text-body text-sm">
                    {user.email}
                  </span>
                  {/* Logout Button */}
                  <LogoutButton />
                </div>

                {/* Mobile: User Avatar + Hamburger Menu */}
                <div className="flex md:hidden items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gg-primary)] text-white font-semibold text-sm">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <MobileNav 
                    userEmail={user.email || null} 
                    userInitial={user.email?.charAt(0).toUpperCase() || 'U'} 
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link href="/login" className="gg-btn-primary gg-btn-sm text-sm">
                  Log In
                </Link>
                <Link href="/login" className="gg-btn-outline gg-btn-sm text-sm hidden sm:inline-flex">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

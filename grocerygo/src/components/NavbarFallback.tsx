import Link from 'next/link'

/** Logged-out navbar shell — used as Suspense fallback so layout doesn't block on auth. */
export default function NavbarFallback() {
  return (
    <nav className="border-b border-[var(--gg-border)] bg-white shadow-sm">
      <div className="gg-container">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--gg-primary)] transition-opacity hover:opacity-80">
              GroceryGo
            </h1>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="gg-btn-primary gg-btn-sm text-sm">
              Log In
            </Link>
            <Link href="/login" className="gg-btn-outline gg-btn-sm text-sm hidden sm:inline-flex">
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

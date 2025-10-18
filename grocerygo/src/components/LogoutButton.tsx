'use client'

import { logout } from '@/app/actions/auth'

export default function LogoutButton() {
  const handleLogout = async () => {
    await logout()
  }

  return (
    <button
      onClick={handleLogout}
      className="gg-btn-sm rounded-lg border-2 border-gray-200 font-semibold transition-all hover:border-[var(--gg-success)] hover:text-[var(--gg-outline)]"
    >
      Logout
    </button>
  )
}


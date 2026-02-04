'use client'

import { useState, useRef, useEffect } from 'react'

interface IngredientActionsProps {
  itemId: string
  itemName: string
  onExclude?: (itemId: string, itemName: string) => void
  onFavor?: (itemId: string, itemName: string) => void
}

export default function IngredientActions({
  itemId,
  itemName,
  onExclude,
  onFavor
}: IngredientActionsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

  const handleExclude = () => {
    if (onExclude) {
      onExclude(itemId, itemName)
    }
    setIsMenuOpen(false)
  }

  const handleFavor = () => {
    if (onFavor) {
      onFavor(itemId, itemName)
    }
    setIsMenuOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Menu Button */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="p-1 rounded hover:bg-gray-100 transition-colors"
        title="More options"
      >
        <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900 truncate capitalize">{itemName}</p>
          </div>
          
          <button
            onClick={handleExclude}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-red-50 transition-colors group"
          >
            <svg
              className="h-5 w-5 text-gray-400 group-hover:text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900 group-hover:text-red-600">
                Add to Foods You Dislike
              </p>
              <p className="text-xs text-gray-500 group-hover:text-red-600">
                Avoid this ingredient in future plans
              </p>
            </div>
          </button>

          <button
            onClick={handleFavor}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-green-50 transition-colors group"
          >
            <svg
              className="h-5 w-5 text-gray-400 group-hover:text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900 group-hover:text-green-600">
                Add to Foods You Like
              </p>
              <p className="text-xs text-gray-500 group-hover:text-green-600">
                Prioritize this ingredient in future plans
              </p>
            </div>
          </button>

          <div className="mt-2 px-4 py-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Changes will apply to future meal plans
            </p>
          </div>
        </div>
      )}
    </div>
  )
}


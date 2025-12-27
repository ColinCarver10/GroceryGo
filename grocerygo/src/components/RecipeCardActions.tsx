'use client'

import { useState, useEffect } from 'react'

interface RecipeCardActionsProps {
  recipeId: string
  recipeName: string
  isFavorite: boolean
  onReplace?: (recipeId: string) => void
  onToggleFavorite?: (recipeId: string, isFavorite: boolean) => void
  isReplacing?: boolean // External control of replacing state
}

export default function RecipeCardActions({
  recipeId,
  isFavorite,
  onReplace,
  onToggleFavorite,
  isReplacing: externalIsReplacing
}: RecipeCardActionsProps) {
  const [internalIsReplacing, setInternalIsReplacing] = useState(false)
  
  // Use external state if provided, otherwise use internal state
  const isReplacing = externalIsReplacing !== undefined ? externalIsReplacing : internalIsReplacing

  // Reset loading state when recipeId changes (after refresh)
  useEffect(() => {
    if (externalIsReplacing === undefined) {
      setInternalIsReplacing(false)
    }
  }, [recipeId, externalIsReplacing])

  // Reset internal state when external state changes to false
  useEffect(() => {
    if (externalIsReplacing === false && internalIsReplacing) {
      setInternalIsReplacing(false)
    }
  }, [externalIsReplacing, internalIsReplacing])

  const handleReplace = () => {
    if (onReplace) {
      if (externalIsReplacing === undefined) {
        setInternalIsReplacing(true)
      }
      onReplace(recipeId)
    }
  }

  const handleFavorite = () => {
    if (onToggleFavorite) {
      onToggleFavorite(recipeId, !isFavorite)
    }
  }

  return (
    <div className="flex gap-2">
      {/* Favorite Toggle */}
      <button
        onClick={handleFavorite}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
          isFavorite
            ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100'
            : 'border-gray-200 bg-white text-gray-600 hover:border-red-500 hover:text-red-700'
        }`}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <svg
          className="h-5 w-5"
          fill={isFavorite ? 'currentColor' : 'none'}
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
        {isFavorite ? 'Saved' : 'Save'}
      </button>

      {/* Replace Button */}
      <button
        onClick={handleReplace}
        disabled={isReplacing}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-gray-200 bg-white text-gray-700 hover:border-[var(--gg-primary)] hover:text-[var(--gg-primary)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Replace this recipe"
      >
        {isReplacing ? (
          <>
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Replacing...
          </>
        ) : (
          <>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Replace
          </>
        )}
      </button>
    </div>
  )
}


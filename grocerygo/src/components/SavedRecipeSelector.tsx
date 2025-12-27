'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Recipe } from '@/types/database'
import { getSavedRecipes } from '@/app/actions/userPreferences'

interface SavedRecipeSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (recipeId: string) => void
  mealType: 'breakfast' | 'lunch' | 'dinner'
  userId: string
  excludeRecipeId?: string // Recipe ID to exclude from the list (current recipe being replaced)
}

interface SavedRecipeWithDetails {
  id: string
  user_id: string
  recipe_id: string
  created_at: string
  notes?: string
  recipe: Recipe
}

export default function SavedRecipeSelector({
  isOpen,
  onClose,
  onSelect,
  mealType,
  userId,
  excludeRecipeId
}: SavedRecipeSelectorProps) {
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipeWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Fetch saved recipes when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      setError(null)
      setSearchQuery('')
      
      getSavedRecipes(userId)
        .then((recipes) => {
          setSavedRecipes(recipes as SavedRecipeWithDetails[])
          setIsLoading(false)
        })
        .catch((err) => {
          setError('Failed to load saved recipes')
          setIsLoading(false)
        })
    }
  }, [isOpen, userId])

  // Filter recipes by meal type and search query
  const filteredRecipes = useMemo(() => {
    return savedRecipes.filter((savedRecipe) => {
      const recipe = savedRecipe.recipe
      if (!recipe) return false
      
      // Exclude the current recipe being replaced
      if (excludeRecipeId && String(recipe.id) === String(excludeRecipeId)) {
        return false
      }
      
      // Filter by meal type
      const recipeMealType = recipe.meal_type
      if (recipeMealType) {
        // Handle both array and string formats
        const mealTypes = Array.isArray(recipeMealType) 
          ? recipeMealType.filter(mt => mt != null)
          : recipeMealType 
            ? [recipeMealType] 
            : []
        
        if (mealTypes.length > 0) {
          const matchesMealType = mealTypes.some(mt => 
            String(mt).toLowerCase() === mealType.toLowerCase()
          )
          if (!matchesMealType) return false
        }
      }
      
      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesName = recipe.name?.toLowerCase().includes(query)
        // Could also search ingredients, but keeping it simple for now
        return matchesName
      }
      
      return true
    })
  }, [savedRecipes, mealType, searchQuery, excludeRecipeId])

  const handleSelect = (recipeId: string) => {
    onSelect(recipeId)
    onClose()
  }

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black opacity-40 z-50" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
        <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col pointer-events-auto">
          {/* Header */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Select Saved Recipe
            </h3>
            <p className="text-sm text-gray-600">
              Choose a {mealType} recipe from your saved recipes
            </p>
          </div>

          {/* Search Input */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved recipes..."
                className="w-full px-4 py-2 pl-10 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[var(--gg-primary)] transition-colors"
              />
              <svg 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Recipe List */}
          <div className="flex-1 overflow-y-auto mb-4 border border-gray-200 rounded-lg">
            {isLoading ? (
              <div className="p-8 text-center">
                <svg className="animate-spin h-8 w-8 text-[var(--gg-primary)] mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-600">Loading saved recipes...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : filteredRecipes.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <p className="text-gray-600 mb-2">
                  {searchQuery ? 'No recipes match your search' : `No ${mealType} recipes saved yet`}
                </p>
                <p className="text-sm text-gray-500">
                  {searchQuery ? 'Try a different search term' : 'Save recipes from your meal plans to use them here'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredRecipes.map((savedRecipe) => {
                  const recipe = savedRecipe.recipe
                  return (
                    <button
                      key={savedRecipe.id}
                      onClick={() => handleSelect(recipe.id)}
                      className="w-full px-4 py-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-1 capitalize">
                            {recipe.name}
                          </h4>
                          {recipe.prep_time_minutes && (
                            <p className="text-sm text-gray-600 flex items-center gap-1">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {recipe.prep_time_minutes} minutes
                            </p>
                          )}
                          {recipe.ingredients && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <svg className="h-5 w-5 text-[var(--gg-primary)] flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  )
}


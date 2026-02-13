'use client'

import { useState } from 'react'
import type { Recipe } from '@/types/database'
import RecipeModal from '@/components/RecipeModal'
import { invalidateDashboardCache } from './actions'
import { unsaveRecipe } from '@/app/actions/userPreferences'

interface SavedRecipesClientProps {
  userId: string
  savedRecipes: Array<{
    id: string
    recipe_id: string
    created_at: string
    recipe: Recipe
  }>
}

export default function SavedRecipesClient({
  userId,
  savedRecipes: initialSavedRecipes,
}: SavedRecipesClientProps) {
  const [showSavedRecipes, setShowSavedRecipes] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [savedRecipes, setSavedRecipes] = useState(initialSavedRecipes)
  const [actionError, setActionError] = useState<string | null>(null)
  const [recipeToRemove, setRecipeToRemove] = useState<{
    savedRecipeId: string
    recipeId: string
    recipeName: string
  } | null>(null)

  const handleUnsaveRecipeClick = (savedRecipeId: string, recipeId: string, recipeName: string) => {
    setRecipeToRemove({ savedRecipeId, recipeId, recipeName })
  }

  const handleConfirmUnsave = async () => {
    if (!recipeToRemove) return

    const { savedRecipeId, recipeId, recipeName } = recipeToRemove
    
    // Optimistically remove recipe from UI
    const recipeToRestore = savedRecipes.find(sr => sr.id === savedRecipeId)
    setSavedRecipes(prev => prev.filter(sr => sr.id !== savedRecipeId))
    setActionError(null)
    setRecipeToRemove(null)

    try {
      const result = await unsaveRecipe(userId, recipeId, recipeName)
      if (!result.success) {
        // Revert on error
        if (recipeToRestore) {
          setSavedRecipes(prev => [...prev, recipeToRestore].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ))
        }
        setActionError(result.error || 'Failed to remove saved recipe')
      } else {
        // Invalidate cache to ensure consistency
        await invalidateDashboardCache()
      }
    } catch (error) {
      // Revert on error
      if (recipeToRestore) {
        setSavedRecipes(prev => [...prev, recipeToRestore].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ))
      }
      setActionError('An unexpected error occurred')
      console.error('Error unsaving recipe:', error)
    }
  }

  const handleCancelUnsave = () => {
    setRecipeToRemove(null)
  }

  return (
    <>
      <div className="gg-card mt-8">
        <button
          onClick={() => setShowSavedRecipes(!showSavedRecipes)}
          className="flex w-full items-center justify-between gap-2"
        >
          <h2 className="gg-heading-section flex items-center gap-2 text-lg sm:text-2xl">
            <svg className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--gg-primary)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="hidden sm:inline">Saved Recipes ({savedRecipes.length})</span>
            <span className="sm:hidden">Saved ({savedRecipes.length})</span>
          </h2>
          <svg 
            className={`h-5 w-5 text-gray-600 transition-transform ${showSavedRecipes ? 'rotate-180' : ''}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showSavedRecipes && savedRecipes.length > 0 && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {savedRecipes.map((savedRecipe) => {
                const recipe = savedRecipe.recipe
                return (
                  <div
                    key={savedRecipe.id}
                    className="rounded-xl border-2 border-gray-200 bg-white p-5 transition-all hover:border-[var(--gg-primary)] hover:shadow-md cursor-pointer"
                    onClick={() => setSelectedRecipe(recipe)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="gg-heading-card flex-1 capitalize">{recipe.name}</h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUnsaveRecipeClick(savedRecipe.id, recipe.id, recipe.name)
                        }}
                        className="flex-shrink-0 ml-2 p-1.5 rounded-full border-1 border-red-300 hover:border-red-500 hover:bg-red-50 transition-all"
                        title="Remove from saved recipes"
                      >
                        <svg className="h-5 w-5 text-red-500 cursor-pointer" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>

                    {/* Recipe Info */}
                    <div className="mb-3 flex flex-wrap gap-3 text-sm text-gray-600">
                      {recipe.prep_time_minutes && (
                        <span className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {recipe.prep_time_minutes}m
                        </span>
                      )}
                      {recipe.servings && (
                        <span className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {recipe.servings} servings
                        </span>
                      )}
                    </div>

                    {/* Ingredients preview */}
                    <div>
                      <p className="mb-2 text-xs font-semibold text-gray-700">Ingredients:</p>
                      <ul className="space-y-1 text-sm text-gray-600">
                        {recipe.ingredients.slice(0, 2).map((ing, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-[var(--gg-primary)]">•</span>
                            <span className="truncate">{ing.item}</span>
                          </li>
                        ))}
                        {recipe.ingredients.length > 2 && (
                          <li className="text-gray-400 text-xs">
                            +{recipe.ingredients.length - 2} more...
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="mt-3 text-xs text-gray-500">
                      Saved {new Date(savedRecipe.created_at).toLocaleDateString()}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {showSavedRecipes && savedRecipes.length === 0 && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="gg-heading-card mb-2">No saved recipes yet</h3>
              <p className="gg-text-body text-sm">
                Save recipes from your meal plans by clicking the ❤️ button
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Recipe Modal */}
      {selectedRecipe && (
        <RecipeModal
          recipe={selectedRecipe}
          isOpen={!!selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}

      {/* Action Error Toast */}
      {actionError && (
        <div className="fixed bottom-4 right-4 bg-red-50 border-2 border-red-500 rounded-lg p-4 shadow-lg z-50 max-w-md">
          <div className="flex items-start gap-3">
            <svg className="h-6 w-6 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900">Action Failed</p>
              <p className="text-sm text-red-800 mt-1">{actionError}</p>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Confirm Remove Recipe Modal */}
      {recipeToRemove && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black opacity-40 z-50" 
            onClick={handleCancelUnsave}
          />
          
          {/* Modal Content */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full pointer-events-auto">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove Saved Recipe?</h3>
                  <p className="text-sm text-gray-600">
                    Are you sure you want to remove <span className="font-semibold capitalize">{recipeToRemove.recipeName}</span> from your saved recipes? This action cannot be undone.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCancelUnsave}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUnsave}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

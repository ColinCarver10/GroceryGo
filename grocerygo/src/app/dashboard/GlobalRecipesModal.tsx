'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Recipe } from '@/types/database'
import RecipeModal from '@/components/RecipeModal'
import { getGlobalRecipesData } from './actions'
import { saveRecipe } from '@/app/actions/userPreferences'

interface GlobalRecipesModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  savedRecipeIds: string[]
  onRecipeSaved: (recipe: Recipe) => void
}

interface GlobalRecipeItem {
  recipe: Recipe
  saveCount: number
  latestSavedAt: string
}

const PAGE_SIZE = 12

export default function GlobalRecipesModal({
  isOpen,
  onClose,
  userId,
  savedRecipeIds,
  onRecipeSaved
}: GlobalRecipesModalProps) {
  const [recipes, setRecipes] = useState<GlobalRecipeItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [mealType, setMealType] = useState('all')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [savingRecipeId, setSavingRecipeId] = useState<string | null>(null)

  const savedRecipeIdSet = useMemo(() => new Set(savedRecipeIds), [savedRecipeIds])

  const loadRecipes = useCallback(async (nextOffset: number, append: boolean) => {
    if (append) setIsLoadingMore(true)
    else setIsLoading(true)
    setError(null)

    try {
      const result = await getGlobalRecipesData(userId, {
        search: search.trim(),
        mealType,
        limit: PAGE_SIZE,
        offset: nextOffset
      })

      setHasMore(result.hasMore)
      setOffset(nextOffset)
      setRecipes((prev) => (append ? [...prev, ...result.recipes] : result.recipes))
    } catch (loadError) {
      setError('Failed to load global recipes')
      console.error('Error loading global recipes:', loadError)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [mealType, search, userId])

  useEffect(() => {
    if (!isOpen) return
    setSearch('')
    setMealType('all')
    setOffset(0)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      void loadRecipes(0, false)
    }, 250)

    return () => clearTimeout(timer)
  }, [isOpen, loadRecipes])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return
    await loadRecipes(offset + PAGE_SIZE, true)
  }

  const handleSaveRecipe = async (recipe: Recipe) => {
    if (savingRecipeId || savedRecipeIdSet.has(recipe.id)) return
    setSavingRecipeId(recipe.id)

    try {
      const result = await saveRecipe(userId, recipe.id, recipe.name)
      if (!result.success) {
        setError(result.error || `Failed to save ${recipe.name}`)
        return
      }
      onRecipeSaved(recipe)
    } catch (saveError) {
      setError(`Failed to save ${recipe.name}`)
      console.error('Error saving global recipe:', saveError)
    } finally {
      setSavingRecipeId(null)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black opacity-40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] p-6 pointer-events-auto flex flex-col"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Browse Global Recipes</h3>
              <p className="text-sm text-gray-600 mt-1">
                Explore recipes saved by other users and add them to your own saved list.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-900"
              aria-label="Close global recipes modal"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3 mb-4">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, ingredients, or tags..."
                className="w-full px-4 py-2 pl-10 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[var(--gg-primary)]"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <select
              value={mealType}
              onChange={(event) => setMealType(event.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[var(--gg-primary)] capitalize"
            >
              <option value="all">All meal types</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
            {isLoading ? (
              <div className="p-10 text-center text-gray-600">Loading global recipes...</div>
            ) : error ? (
              <div className="p-10 text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={() => void loadRecipes(0, false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  Retry
                </button>
              </div>
            ) : recipes.length === 0 ? (
              <div className="p-10 text-center text-gray-600">
                No global recipes match your filters yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                {recipes.map(({ recipe, saveCount, latestSavedAt }) => {
                  const isSaved = savedRecipeIdSet.has(recipe.id)
                  const isSaving = savingRecipeId === recipe.id

                  return (
                    <div
                      key={recipe.id}
                      className="rounded-xl border-2 border-gray-200 p-4 hover:border-[var(--gg-primary)] transition-colors"
                    >
                      <button
                        onClick={() => setSelectedRecipe(recipe)}
                        className="text-left w-full"
                      >
                        <h4 className="font-semibold text-gray-900 capitalize">{recipe.name}</h4>
                        <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-2">
                          <span>{saveCount} save{saveCount !== 1 ? 's' : ''}</span>
                          <span>Most recent {new Date(latestSavedAt).toLocaleDateString()}</span>
                        </div>
                        {Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                            {recipe.ingredients.slice(0, 3).map((ing) => ing.item).join(', ')}
                          </p>
                        )}
                      </button>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setSelectedRecipe(recipe)}
                          className="text-sm text-gray-700 hover:text-gray-900 underline"
                        >
                          View details
                        </button>
                        <button
                          onClick={() => void handleSaveRecipe(recipe)}
                          disabled={isSaved || isSaving}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg text-white bg-[var(--gg-primary)] disabled:opacity-50"
                        >
                          {isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Close
            </button>
            {hasMore && (
              <button
                onClick={() => void handleLoadMore()}
                disabled={isLoadingMore}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--gg-primary)] rounded-lg disabled:opacity-60"
              >
                {isLoadingMore ? 'Loading...' : 'Load more'}
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedRecipe && (
        <RecipeModal
          recipe={selectedRecipe}
          isOpen={!!selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </>
  )
}

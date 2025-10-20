'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { MealPlanWithRecipes, Recipe } from '@/types/database'
import RecipeModal from '@/components/RecipeModal'
import RecipeCardActions from '@/components/RecipeCardActions'
import AdjustPlanPanel from '@/components/AdjustPlanPanel'
import IngredientActions from '@/components/IngredientActions'
import type { PlanAdjustments } from '@/components/AdjustPlanPanel'
import { 
  createInstacartOrder,
  replaceRecipe,
  regenerateWithAdjustments,
  saveCookingNote,
  // scaleRecipeServings, // COMMENTED OUT: Scale servings functionality
  // swapIngredient, // COMMENTED OUT: Swap ingredient functionality
  // simplifyRecipe // COMMENTED OUT: Simplify recipe functionality
} from './actions'
import { excludeIngredient, favorIngredient, saveRecipe, unsaveRecipe } from '@/app/actions/userPreferences'
import { useRouter } from 'next/navigation'

interface MealPlanViewProps {
  mealPlan: MealPlanWithRecipes
  savedRecipeIds: string[]
}

export default function MealPlanView({ mealPlan, savedRecipeIds }: MealPlanViewProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'recipes' | 'shopping'>('recipes')
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [isOrderingInstacart, setIsOrderingInstacart] = useState(false)
  const [instacartError, setInstacartError] = useState<string | null>(null)
  
  // New state for meal plan adjustments
  const [isAdjustPanelOpen, setIsAdjustPanelOpen] = useState(false)
  const [favoriteRecipes, setFavoriteRecipes] = useState<Set<string>>(new Set(savedRecipeIds))
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const toggleItem = (itemId: string) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  // Handler functions for new features
  const handleReplaceRecipe = async (recipeId: string) => {
    setIsProcessing(true)
    setActionError(null)
    
    try {
      // Find the meal type for this recipe
      const mealPlanRecipe = mealPlan.meal_plan_recipes.find(mpr => mpr.recipe_id === recipeId)
      const mealType = mealPlanRecipe?.meal_type || 'dinner'
      
      const result = await replaceRecipe(mealPlan.id, recipeId, mealType)
      
      if (result.success) {
        router.refresh()
      } else {
        setActionError(result.error || 'Failed to replace recipe')
      }
    } catch (error) {
      setActionError('An unexpected error occurred:' + error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleToggleFavorite = async (recipeId: string, isFavorite: boolean) => {
    // Get recipe name for feedback tracking
    const recipe = mealPlan.meal_plan_recipes.find(mpr => mpr.recipe_id === recipeId)?.recipe
    const recipeName = recipe?.name || 'Unknown Recipe'
    
    // Optimistically update UI
    setFavoriteRecipes(prev => {
      const newSet = new Set(prev)
      if (isFavorite) {
        newSet.add(recipeId)
      } else {
        newSet.delete(recipeId)
      }
      return newSet
    })

    try {
      if (isFavorite) {
        const result = await saveRecipe(mealPlan.user_id, recipeId, recipeName, mealPlan.id)
        if (!result.success) {
          // Revert on error
          setFavoriteRecipes(prev => {
            const newSet = new Set(prev)
            newSet.delete(recipeId)
            return newSet
          })
          setActionError(result.error || 'Failed to save recipe')
        }
      } else {
        const result = await unsaveRecipe(mealPlan.user_id, recipeId, recipeName, mealPlan.id)
        if (!result.success) {
          // Revert on error
          setFavoriteRecipes(prev => {
            const newSet = new Set(prev)
            newSet.add(recipeId)
            return newSet
          })
          setActionError(result.error || 'Failed to unsave recipe')
        }
      }
    } catch (error) {
      // Revert on error
      setFavoriteRecipes(prev => {
        const newSet = new Set(prev)
        if (isFavorite) {
          newSet.delete(recipeId)
        } else {
          newSet.add(recipeId)
        }
        return newSet
      })
      setActionError('An unexpected error occurred' + error)
    }
  }

  const handleApplyAdjustments = async (adjustments: PlanAdjustments) => {
    setIsProcessing(true)
    setActionError(null)
    
    try {
      const result = await regenerateWithAdjustments(mealPlan.id, adjustments)
      
      if (result.success) {
        setIsAdjustPanelOpen(false)
        router.refresh()
      } else {
        setActionError(result.error || 'Failed to apply adjustments')
      }
    } catch (error) {
      setActionError('An unexpected error occurred' + error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExcludeIngredient = async (itemId: string, itemName: string) => {
    setIsProcessing(true)
    setActionError(null)
    
    try {
      // Get current user from mealPlan
      const result = await excludeIngredient(mealPlan.user_id, itemName)
      
      if (!result.success) {
        setActionError(result.error || 'Failed to exclude ingredient')
      }
    } catch (error) {
      setActionError('An unexpected error occurred' + error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFavorIngredient = async (itemId: string, itemName: string) => {
    setIsProcessing(true)
    setActionError(null)
    
    try {
      const result = await favorIngredient(mealPlan.user_id, itemName)
      
      if (!result.success) {
        setActionError(result.error || 'Failed to favor ingredient')
      }
    } catch (error) {
      setActionError('An unexpected error occurred' + error)
    } finally {
      setIsProcessing(false)
    }
  }

  // COMMENTED OUT: Scale servings functionality (may be added back later)
  // const handleScaleServings = async (recipeId: string, multiplier: number) => {
  //   setIsProcessing(true)
  //   setActionError(null)
  //   
  //   try {
  //     const result = await scaleRecipeServings(mealPlan.id, recipeId, multiplier)
  //     
  //     if (result.success) {
  //       router.refresh()
  //     } else {
  //       setActionError(result.error || 'Failed to scale recipe')
  //     }
  //   } catch (error) {
  //     setActionError('An unexpected error occurred')
  //   } finally {
  //     setIsProcessing(false)
  //   }
  // }

  // COMMENTED OUT: Swap ingredient functionality (may be added back later)
  // const handleSwapIngredient = async (recipeId: string, oldIngredient: string, newIngredient: string) => {
  //   setIsProcessing(true)
  //   setActionError(null)
  //   
  //   try {
  //     const result = await swapIngredient(mealPlan.id, recipeId, oldIngredient, newIngredient)
  //     
  //     if (result.success) {
  //       router.refresh()
  //     } else {
  //       setActionError(result.error || 'Failed to swap ingredient')
  //     }
  //   } catch (error) {
  //     setActionError('An unexpected error occurred')
  //   } finally {
  //     setIsProcessing(false)
  //   }
  // }

  // COMMENTED OUT: Simplify recipe functionality (may be added back later)
  // const handleSimplifySteps = async (recipeId: string) => {
  //   setIsProcessing(true)
  //   setActionError(null)
  //   
  //   try {
  //     const result = await simplifyRecipe(mealPlan.id, recipeId)
  //     
  //     if (result.success) {
  //       router.refresh()
  //     } else {
  //       setActionError(result.error || 'Failed to simplify recipe')
  //     }
  //   } catch (error) {
  //     setActionError('An unexpected error occurred')
  //   } finally {
  //     setIsProcessing(false)
  //   }
  // }

  // Handler for saving cooking notes from AI assistant
  const handleSaveCookingNote = async (recipeId: string, note: string) => {
    try {
      const result = await saveCookingNote(recipeId, note)
      
      if (result.success) {
        // Refresh the page to show updated notes
        router.refresh()
      } else {
        console.error('Failed to save cooking note:', result.error)
      }
    } catch (error) {
      console.error('Error saving cooking note:', error)
    }
  }

  const handleOrderInstacart = async () => {
    if (mealPlan.grocery_items.length === 0) {
      setInstacartError('No items to order')
      return
    }

    setIsOrderingInstacart(true)
    setInstacartError(null)

    try {
      const mealPlanUrl = `${window.location.origin}/meal-plan/${mealPlan.id}`
      const mealPlanTitle = `Meal Plan for ${formatDate(mealPlan.week_of)}`
      
      const result = await createInstacartOrder(
        mealPlan.grocery_items,
        mealPlanTitle,
        mealPlanUrl
      )

      if (result.success && result.link) {
        // Open Instacart in a new tab
        window.open(result.link, '_blank')
      } else {
        setInstacartError(result.error || 'Failed to create Instacart order')
      }
    } catch (error) {
      setInstacartError('An unexpected error occurred')
      console.error('Error ordering from Instacart:', error)
    } finally {
      setIsOrderingInstacart(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-100 text-green-800',
      'in-progress': 'bg-blue-100 text-blue-800',
      pending: 'bg-gray-100 text-gray-800'
    }
    const labels = {
      completed: 'Completed',
      'in-progress': 'In Progress',
      pending: 'Pending'
    }
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  // Group recipes by meal type if available
  const recipesByType = mealPlan.meal_plan_recipes.reduce((acc, mpr) => {
    const type = mpr.meal_type || 'other'
    if (!acc[type]) acc[type] = []
    acc[type].push(mpr)
    return acc
  }, {} as Record<string, typeof mealPlan.meal_plan_recipes>)

  const mealTypeEmojis = {
    breakfast: '🍳',
    lunch: '🥗',
    dinner: '🍽️',
    snack: '🍪',
    other: '🍴'
  }

  return (
    <div className="gg-bg-page min-h-screen">
      <div className="gg-container">
        <div className="gg-section">
          
          {/* Header */}
          <div className="mb-8">
            <Link 
              href="/dashboard" 
              className="gg-text-body text-sm mb-4 inline-flex items-center gap-2 hover:text-[var(--gg-primary)] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
            
            <div className="flex items-start justify-between">
              <div>
                <h1 className="gg-heading-page mb-2">
                  Meal Plan for {formatDate(mealPlan.week_of)}
                </h1>
                <p className="gg-text-subtitle">
                  {mealPlan.total_meals} meals • Created {new Date(mealPlan.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(mealPlan.status)}
                
                {/* Adjust Plan Button */}
                <button
                  onClick={() => setIsAdjustPanelOpen(true)}
                  className="gg-btn-outline flex items-center gap-2"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Adjust Plan
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab('recipes')}
                className={`pb-4 px-1 border-b-2 font-semibold transition-colors ${
                  activeTab === 'recipes'
                    ? 'border-[var(--gg-primary)] text-[var(--gg-primary)]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Recipes ({mealPlan.meal_plan_recipes.length})
                </span>
              </button>
              <button
                onClick={() => setActiveTab('shopping')}
                className={`pb-4 px-1 border-b-2 font-semibold transition-colors ${
                  activeTab === 'shopping'
                    ? 'border-[var(--gg-primary)] text-[var(--gg-primary)]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Shopping List ({mealPlan.grocery_items.length})
                </span>
              </button>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'recipes' ? (
            <div className="space-y-6">
              {Object.entries(recipesByType).map(([mealType, recipes]) => (
                <div key={mealType} className="gg-card">
                  <h2 className="gg-heading-section mb-6 flex items-center gap-2">
                    <span>{mealTypeEmojis[mealType as keyof typeof mealTypeEmojis]}</span>
                    <span className="capitalize">{mealType}</span>
                    <span className="text-gray-400">({recipes.length})</span>
                  </h2>
                  
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {recipes.map((mpr) => {
                      if (!mpr.recipe) return null
                      const recipe = mpr.recipe
                      
                      return (
                        <div
                          key={mpr.id}
                          className="rounded-xl border-2 border-gray-200 bg-white p-6 transition-all hover:border-[var(--gg-primary)] hover:shadow-md"
                        >
                          <h3 className="gg-heading-card mb-4">{recipe.name}</h3>
                          
                          {/* Recipe Info */}
                          <div className="mb-4 flex flex-wrap gap-3 text-sm text-gray-600">
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

                          {/* Ingredients */}
                          <div className="mb-4">
                            <p className="mb-2 text-sm font-semibold text-gray-700">Ingredients:</p>
                            <ul className="space-y-1 text-sm text-gray-600">
                              {recipe.ingredients.slice(0, 3).map((ing, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-[var(--gg-primary)]">•</span>
                                  <span>{ing.quantity} {ing.item}</span>
                                </li>
                              ))}
                              {recipe.ingredients.length > 3 && (
                                <li className="text-gray-400">
                                  +{recipe.ingredients.length - 3} more...
                                </li>
                              )}
                            </ul>
                          </div>

                          {/* Recipe Actions */}
                          <div className="mb-3">
                            <RecipeCardActions
                              recipeId={recipe.id}
                              recipeName={recipe.name}
                              isFavorite={favoriteRecipes.has(recipe.id)}
                              onReplace={handleReplaceRecipe}
                              onToggleFavorite={handleToggleFavorite}
                            />
                          </div>

                          <button 
                            onClick={() => setSelectedRecipe(recipe)}
                            className="gg-btn-outline w-full text-sm py-2"
                          >
                            View Full Recipe
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {mealPlan.meal_plan_recipes.length === 0 && (
                <div className="gg-card text-center py-12">
                  <p className="gg-text-body text-gray-500">No recipes found for this meal plan.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="gg-card">
                  <h2 className="gg-heading-section mb-6">Shopping List</h2>
                  
                  {mealPlan.grocery_items.length > 0 ? (
                    <div className="space-y-2">
                      {mealPlan.grocery_items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-4 rounded-lg border-2 p-4 transition-all ${
                            checkedItems.has(item.id)
                              ? 'border-gray-200 bg-gray-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <button
                            onClick={() => toggleItem(item.id)}
                            className={`flex h-6 w-6 items-center justify-center rounded border-2 transition-all ${
                              checkedItems.has(item.id)
                                ? 'border-[var(--gg-primary)] bg-[var(--gg-primary)]'
                                : 'border-gray-300 hover:border-[var(--gg-primary)]'
                            }`}
                          >
                            {checkedItems.has(item.id) && (
                              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          
                          <div className="flex-1">
                            <p className={`font-medium ${checkedItems.has(item.id) ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                              {item.item_name}
                            </p>
                            {item.quantity && item.unit && (
                              <p className="text-sm text-gray-500">
                                {item.quantity} {item.unit}
                              </p>
                            )}
                          </div>

                          {item.category && (
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                              {item.category}
                            </span>
                          )}

                          {item.estimated_price && (
                            <span className="font-semibold text-gray-700">
                              ${item.estimated_price.toFixed(2)}
                            </span>
                          )}

                          {/* Ingredient Actions Menu */}
                          <IngredientActions
                            itemId={item.id}
                            itemName={item.item_name}
                            onExclude={handleExcludeIngredient}
                            onFavor={handleFavorIngredient}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="gg-text-body text-gray-500">No items in shopping list.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Summary */}
              <div className="space-y-6">
                <div className="gg-card">
                  <h3 className="gg-heading-section mb-4">Shopping Summary</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="gg-text-body text-sm">Total Items</span>
                      <span className="text-2xl font-bold text-[var(--gg-primary)]">
                        {mealPlan.grocery_items.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="gg-text-body text-sm">Checked Off</span>
                      <span className="text-2xl font-bold text-[var(--gg-primary)]">
                        {checkedItems.size}
                      </span>
                    </div>
                    {mealPlan.total_budget && (
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <span className="font-semibold text-gray-900">Est. Total</span>
                        <span className="text-2xl font-bold text-[var(--gg-primary)]">
                          ${mealPlan.total_budget.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Order from Instacart */}
                <div className="gg-card">
                  <button
                    onClick={handleOrderInstacart}
                    disabled={isOrderingInstacart || mealPlan.grocery_items.length === 0}
                    className="w-full gg-btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isOrderingInstacart ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating Order...
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Order from Instacart
                      </>
                    )}
                  </button>
                  
                  {instacartError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{instacartError}</p>
                    </div>
                  )}
                  
                  <p className="mt-3 text-xs text-gray-500 text-center">
                    Your shopping list will open in Instacart where you can complete your order
                  </p>
                </div>

                <div className="gg-card bg-blue-50 border-blue-200">
                  <div className="flex gap-3">
                    <svg className="h-6 w-6 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">
                        Shopping Tip
                      </p>
                      <p className="text-sm text-blue-800">
                        Check items off as you shop to keep track of what you&apos;ve picked up!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Recipe Modal */}
      {selectedRecipe && (
        <RecipeModal
          recipe={selectedRecipe}
          isOpen={!!selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onSaveCookingNote={handleSaveCookingNote}
          // onScaleServings={handleScaleServings} // COMMENTED OUT: Scale servings functionality
          // onSwapIngredient={handleSwapIngredient} // COMMENTED OUT: Swap ingredient functionality
          // onSimplifySteps={handleSimplifySteps} // COMMENTED OUT: Simplify recipe functionality
        />
      )}

      {/* Adjust Plan Panel */}
      <AdjustPlanPanel
        isOpen={isAdjustPanelOpen}
        onClose={() => setIsAdjustPanelOpen(false)}
        onApplyAdjustments={handleApplyAdjustments}
        appliedAdjustments={mealPlan.survey_snapshot?.applied_adjustments || []}
      />

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

      {/* Processing Overlay */}
      {isProcessing && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black opacity-40 z-50" />
          
          {/* Content */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl p-6 flex flex-col items-center gap-4 pointer-events-auto">
              <svg
                className="animate-spin h-12 w-12 text-[var(--gg-primary)]"
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
              <p className="text-gray-700 font-semibold">Processing your request...</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}


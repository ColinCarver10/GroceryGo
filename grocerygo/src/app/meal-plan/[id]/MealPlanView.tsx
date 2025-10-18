'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { MealPlanWithRecipes, Recipe } from '@/types/database'
import RecipeModal from '@/components/RecipeModal'

interface MealPlanViewProps {
  mealPlan: MealPlanWithRecipes
}

export default function MealPlanView({ mealPlan }: MealPlanViewProps) {
  const [activeTab, setActiveTab] = useState<'recipes' | 'shopping'>('recipes')
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)

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
                <button className="gg-btn-outline text-sm py-2 px-4">
                  Print
                </button>
                <button className="gg-btn-primary text-sm py-2 px-4">
                  Share
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
        />
      )}
    </div>
  )
}


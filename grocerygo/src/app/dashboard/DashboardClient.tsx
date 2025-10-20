'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { MealPlanWithRecipes, Recipe } from '@/types/database'
import RecipeModal from '@/components/RecipeModal'

interface DashboardClientProps {
  surveyResponse: Record<string, any> | null
  mealPlans: MealPlanWithRecipes[]
  savedRecipes: Array<{
    id: string
    recipe_id: string
    created_at: string
    recipe: Recipe
  }>
}

const questionLabels: Record<string, string> = {
  '1': 'Age Range',
  '2': 'Household Size',
  '3': 'Meals per Week',
  '4': 'Weekly Budget',
  '5': 'Cooking Skill Level',
  '6': 'Prep Time Available',
  '7': 'Dietary Restrictions',
  '8': 'Allergies/Intolerances',
  '9': 'Flavor Preferences',
  '10': 'Meal Planning Goals',
  '11': 'Preferred Delivery Days',
  '12': 'Priority Rankings',
}

export default function DashboardClient({ surveyResponse, mealPlans, savedRecipes }: DashboardClientProps) {
  const [showSurveyDropdown, setShowSurveyDropdown] = useState(false)
  const [showSavedRecipes, setShowSavedRecipes] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)

  const formatSurveyValue = (value: string | string[]) => {
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    return value
  }

  const formatWeekOf = (weekStr: string) => {
    // If it's already formatted, return as is
    if (weekStr.includes('-')) return weekStr
    // Otherwise format the date
    const date = new Date(weekStr)
    return date.toLocaleDateString()
  }

  return (
    <div className="gg-bg-page min-h-screen">
      <div className="gg-container">
        <div className="gg-section">
          
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="gg-heading-page mb-2">My Dashboard</h1>
              <p className="gg-text-subtitle">Manage your meal plans and preferences</p>
            </div>
            <Link href="/meal-plan-generate">
              <button className="gg-btn-primary gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Generate New Meal Plan
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            
            {/* Main Content - Meal Plans */}
            <div className="lg:col-span-2">
              <div className="gg-card">
                <h2 className="gg-heading-section mb-6">Previous Meal Plans</h2>
                
                {mealPlans.length > 0 ? (
                  <div className="space-y-4">
                    {mealPlans.map((plan) => (
                      <Link 
                        key={plan.id}
                        href={`/meal-plan/${plan.id}`}
                        className="block group rounded-xl border-2 border-gray-200 bg-white p-6 transition-all hover:border-[var(--gg-primary)] hover:shadow-md"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-2 flex items-center gap-3">
                              <h3 className="gg-heading-card">Week of {formatWeekOf(plan.week_of)}</h3>
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                                plan.status === 'completed' 
                                  ? 'bg-green-100 text-green-800'
                                  : plan.status === 'in-progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {plan.status === 'completed' ? 'Completed' : 
                                 plan.status === 'in-progress' ? 'In Progress' : 'Pending'}
                              </span>
                            </div>
                            
                            <div className="mb-3 flex items-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>Created {new Date(plan.created_at).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                                </svg>
                                <span>{plan.total_meals} meals planned</span>
                              </div>
                            </div>

                            <div className="text-sm text-gray-600">
                              Click to view recipes and shopping list →
                            </div>
                          </div>

                          <svg 
                            className="h-6 w-6 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-[var(--gg-primary)]" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                      <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="gg-heading-card mb-2">No meal plans yet</h3>
                    <p className="gg-text-body mb-6">Get started by generating your first meal plan!</p>
                    <Link href="/meal-plan-generate">
                      <button className="gg-btn-primary">
                        Create Your First Meal Plan
                      </button>
                    </Link>
                  </div>
                )}
              </div>

              {/* Saved Recipes Section */}
              <div className="gg-card mt-8">
                <button
                  onClick={() => setShowSavedRecipes(!showSavedRecipes)}
                  className="flex w-full items-center justify-between"
                >
                  <h2 className="gg-heading-section flex items-center gap-2">
                    <svg className="h-6 w-6 text-[var(--gg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    Saved Recipes ({savedRecipes.length})
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
                              <h3 className="gg-heading-card flex-1">{recipe.name}</h3>
                              <svg className="h-5 w-5 text-red-500 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
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
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              
              {/* Survey Responses Card */}
              <div className="gg-card">
                <button
                  onClick={() => setShowSurveyDropdown(!showSurveyDropdown)}
                  className="flex w-full items-center justify-between"
                >
                  <h2 className="gg-heading-section">My Preferences</h2>
                  <svg 
                    className={`h-5 w-5 text-gray-600 transition-transform ${showSurveyDropdown ? 'rotate-180' : ''}`}
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showSurveyDropdown && surveyResponse && (
                  <div className="mt-6 space-y-4 border-t border-gray-200 pt-6">
                    {Object.entries(surveyResponse).map(([questionId, answer]) => (
                      <div key={questionId} className="pb-4 border-b border-gray-100 last:border-b-0 last:pb-0">
                        <p className="mb-2 text-sm font-semibold text-gray-700">
                          {questionLabels[questionId] || `Question ${questionId}`}
                        </p>
                        <p className="gg-text-body text-sm">
                          {formatSurveyValue(answer)}
                        </p>
                      </div>
                    ))}
                    
                    <Link href="/onboarding" className="block w-full">
                      <button className="gg-btn-outline w-full mt-4">
                        Update Preferences
                      </button>
                    </Link>
                  </div>
                )}

                {showSurveyDropdown && !surveyResponse && (
                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <p className="gg-text-body text-sm mb-4">You haven&apos;t completed the survey yet.</p>
                    <Link href="/onboarding" className="block w-full">
                      <button className="gg-btn-primary w-full">
                        Complete Survey
                      </button>
                    </Link>
                  </div>
                )}
              </div>

              {/* Quick Stats Card */}
              <div className="gg-card">
                <h2 className="gg-heading-section mb-6">Quick Stats</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="gg-text-body text-sm">Total Meal Plans</span>
                    <span className="text-2xl font-bold text-[var(--gg-primary)]">
                      {mealPlans.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="gg-text-body text-sm">Total Meals Planned</span>
                    <span className="text-2xl font-bold text-[var(--gg-primary)]">
                      {mealPlans.reduce((sum, plan) => sum + plan.total_meals, 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="gg-text-body text-sm">Saved Recipes</span>
                    <span className="text-2xl font-bold text-[var(--gg-primary)]">
                      {savedRecipes.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="gg-text-body text-sm">This Month</span>
                    <span className="text-2xl font-bold text-[var(--gg-primary)]">
                      {mealPlans.filter(plan => {
                        const planDate = new Date(plan.created_at)
                        const now = new Date()
                        return planDate.getMonth() === now.getMonth() && 
                               planDate.getFullYear() === now.getFullYear()
                      }).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
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


'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { MealPlanWithRecipes, Recipe } from '@/types/database'
import RecipeModal from '@/components/RecipeModal'
import { updateSurveyResponse } from './actions'

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

interface QuestionConfig {
  label: string
  type: 'multiple-choice' | 'multiple-select' | 'ranking' | 'removable-list'
  options: string[]
  maxSelections?: number
}

const questionLabels: Record<string, string> = {
  '1': 'Age Range',
  '2': 'Household Size',
  '3': 'Weekly Budget',
  '4': 'Cooking Skill Level',
  '5': 'Prep Time Available',
  '6': 'Dietary Restrictions',
  '7': 'Allergies/Intolerances',
  '8': 'Flavor Preferences',
  '9': 'Meal Planning Goals',
  '10': 'Preferred Delivery Days',
  '11': 'Priority Rankings',
  'favored_ingredients': 'Favored Ingredients',
  'excluded_ingredients': 'Excluded Ingredients',
}

const questionConfigs: Record<string, QuestionConfig> = {
  '1': {
    label: 'Age Range',
    type: 'multiple-choice',
    options: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'],
  },
  '2': {
    label: 'Household Size',
    type: 'multiple-choice',
    options: ['Just me', '2 people', '3-4 people', '5+ people'],
  },
  '3': {
    label: 'Weekly Budget',
    type: 'multiple-choice',
    options: ['$50-100', '$101-200', '$201-300', '$301+'],
  },
  '4': {
    label: 'Cooking Skill Level',
    type: 'multiple-choice',
    options: [
      'Beginner (Basic cooking skills)',
      'Intermediate (Comfortable with most recipes)',
      'Advanced (Confident with complex techniques)'
    ],
  },
  '5': {
    label: 'Prep Time Available',
    type: 'multiple-choice',
    options: [
      'Quick (15-30 minutes)',
      'Standard (30-45 minutes)',
      'Extended (45+ minutes)'
    ],
  },
  '6': {
    label: 'Dietary Restrictions',
    type: 'multiple-select',
    options: [
      'No restrictions',
      'Vegetarian',
      'Vegan',
      'Gluten-free',
      'Dairy-free',
      'Keto/Low-carb',
      'Paleo',
      'Other'
    ],
  },
  '7': {
    label: 'Allergies/Intolerances',
    type: 'multiple-select',
    options: [
      'None',
      'Nuts',
      'Shellfish',
      'Eggs',
      'Soy',
      'Wheat',
      'Other'
    ],
  },
  '8': {
    label: 'Flavor Preferences',
    type: 'multiple-select',
    options: [
      'Spicy',
      'Sweet',
      'Savory',
      'Tangy/Acidic',
      'Mild',
      'Umami/Rich'
    ],
    maxSelections: 3,
  },
  '9': {
    label: 'Meal Planning Goals',
    type: 'multiple-select',
    options: [
      'Save time on meal planning',
      'Eat healthier',
      'Learn new recipes',
      'Save money on groceries',
      'Reduce food waste',
      'Other',
    ],
  },
  '10': {
    label: 'Preferred Delivery Days',
    type: 'multiple-select',
    options: [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ],
    maxSelections: 2,
  },
  '11': {
    label: 'Priority Rankings',
    type: 'ranking',
    options: [
      'Cost efficiency',
      'Time saving',
      'Nutrition'
    ],
  },
  'favored_ingredients': {
    label: 'Favored Ingredients',
    type: 'removable-list',
    options: [], // Dynamic - comes from user's saved data
  },
  'excluded_ingredients': {
    label: 'Excluded Ingredients',
    type: 'removable-list',
    options: [], // Dynamic - comes from user's saved data
  },
}

export default function DashboardClient({ surveyResponse, mealPlans, savedRecipes }: DashboardClientProps) {
  const [showSurveyDropdown, setShowSurveyDropdown] = useState(false)
  const [showSavedRecipes, setShowSavedRecipes] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string | string[]>('')
  const [isSaving, setIsSaving] = useState(false)

  // Restore preferences menu state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('preferencesMenuOpen')
    if (savedState === 'true') {
      setShowSurveyDropdown(true)
    }
  }, [])

  // Toggle preferences dropdown and persist state
  const toggleSurveyDropdown = () => {
    const newState = !showSurveyDropdown
    setShowSurveyDropdown(newState)
    localStorage.setItem('preferencesMenuOpen', String(newState))
  }

  const formatSurveyValue = (value: string | string[]) => {
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    return value
  }

  const capitalizeWords = (str: string) => {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  const formatWeekOf = (weekStr: string) => {
    // If it's already formatted, return as is
    if (weekStr.includes('-')) return weekStr
    // Otherwise format the date
    const date = new Date(weekStr)
    return date.toLocaleDateString()
  }

  const handleEditStart = (questionId: string, currentValue: string | string[]) => {
    setEditingQuestion(questionId)
    // Ensure arrays are properly initialized for array-based types
    const config = questionConfigs[questionId]
    if (config?.type === 'removable-list' || config?.type === 'multiple-select' || config?.type === 'ranking') {
      setEditValue(Array.isArray(currentValue) ? currentValue : [])
    } else {
      setEditValue(currentValue)
    }
  }

  const handleEditCancel = () => {
    setEditingQuestion(null)
    setEditValue('')
  }

  const handleEditSave = async (questionId: string) => {
    setIsSaving(true)
    try {
      const result = await updateSurveyResponse(questionId, editValue)
      if (result.success) {
        setEditingQuestion(null)
        setEditValue('')
        // Force a page refresh to get updated data
        window.location.reload()
      } else {
        alert(result.error || 'Failed to update preference')
      }
    } catch (error) {
      console.error('Error updating preference:', error)
      alert('Failed to update preference')
    } finally {
      setIsSaving(false)
    }
  }

  const handleMultipleSelect = (option: string, maxSelections?: number) => {
    const current = (editValue as string[]) || []
    const isSelected = current.includes(option)
    
    if (isSelected) {
      setEditValue(current.filter(o => o !== option))
    } else {
      if (maxSelections && current.length >= maxSelections) {
        return // Don't add if max reached
      }
      setEditValue([...current, option])
    }
  }

  const handleRanking = (direction: 'up' | 'down', index: number) => {
    const current = [...(editValue as string[])]
    
    if (direction === 'up' && index > 0) {
      [current[index], current[index - 1]] = [current[index - 1], current[index]]
    } else if (direction === 'down' && index < current.length - 1) {
      [current[index], current[index + 1]] = [current[index + 1], current[index]]
    }
    
    setEditValue(current)
  }

  const handleRemoveItem = (item: string) => {
    const current = (editValue as string[]) || []
    setEditValue(current.filter(i => i !== item))
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
                  onClick={toggleSurveyDropdown}
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
                    {Object.entries({
                      ...surveyResponse,
                      // Ensure ingredient lists are always included
                      favored_ingredients: surveyResponse.favored_ingredients || [],
                      excluded_ingredients: surveyResponse.excluded_ingredients || [],
                    }).map(([questionId, answer]) => {
                      const config = questionConfigs[questionId]
                      const isEditing = editingQuestion === questionId
                      
                      if (!config) return null
                      
                      return (
                        <div key={questionId} className="pb-4 border-b border-gray-100 last:border-b-0 last:pb-0">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm font-semibold text-gray-700">
                              {config.label}
                            </p>
                            {!isEditing && (
                              <button
                                onClick={() => handleEditStart(questionId, answer)}
                                className="text-xs text-[var(--gg-primary)] hover:underline flex items-center gap-1"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                Edit
                              </button>
                            )}
                          </div>

                          {!isEditing ? (
                            <div>
                              {config.type === 'removable-list' && Array.isArray(answer) && answer.length === 0 ? (
                                <p className="gg-text-body text-sm text-gray-400 italic">None</p>
                              ) : config.type === 'removable-list' && Array.isArray(answer) ? (
                                <p className="gg-text-body text-sm">
                                  {answer.map(item => capitalizeWords(item)).join(', ')}
                                </p>
                              ) : (
                                <p className="gg-text-body text-sm">
                                  {formatSurveyValue(answer)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3 mt-3">
                              {/* Multiple Choice */}
                              {config.type === 'multiple-choice' && (
                                <div className="space-y-2">
                                  {config.options.map((option) => {
                                    const isSelected = editValue === option
                                    return (
                                      <button
                                        key={option}
                                        onClick={() => setEditValue(option)}
                                        className={`w-full rounded-lg border-2 p-3 text-left text-sm transition-all ${
                                          isSelected
                                            ? 'border-[var(--gg-primary)] bg-[var(--gg-primary)] bg-opacity-5'
                                            : 'border-gray-200 hover:border-[var(--gg-primary)] hover:border-opacity-50'
                                        }`}
                                      >
                                        <div className="flex items-center">
                                          <div className={`mr-2 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                                            isSelected ? 'border-[var(--gg-primary)]' : 'border-gray-300'
                                          }`}>
                                            {isSelected && (
                                              <div className="h-2 w-2 rounded-full bg-[var(--gg-primary)]" />
                                            )}
                                          </div>
                                          <span>{option}</span>
                                        </div>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}

                              {/* Multiple Select */}
                              {config.type === 'multiple-select' && (
                                <div className="space-y-2">
                                  {config.maxSelections && (
                                    <p className="text-xs text-gray-500 mb-2">
                                      {((editValue as string[])?.length || 0)}/{config.maxSelections} selected
                                    </p>
                                  )}
                                  {config.options.map((option) => {
                                    const selected = (editValue as string[]) || []
                                    const isSelected = selected.includes(option)
                                    const isMaxed = config.maxSelections && selected.length >= config.maxSelections && !isSelected || false
                                    
                                    return (
                                      <button
                                        key={option}
                                        onClick={() => handleMultipleSelect(option, config.maxSelections)}
                                        disabled={isMaxed}
                                        className={`w-full rounded-lg border-2 p-3 text-left text-sm transition-all ${
                                          isSelected
                                            ? 'border-[var(--gg-primary)] bg-[var(--gg-primary)] bg-opacity-5'
                                            : isMaxed
                                            ? 'border-gray-200 opacity-50 cursor-not-allowed'
                                            : 'border-gray-200 hover:border-[var(--gg-primary)] hover:border-opacity-50'
                                        }`}
                                      >
                                        <div className="flex items-center">
                                          <div className={`mr-2 h-4 w-4 rounded border-2 flex items-center justify-center ${
                                            isSelected ? 'border-[var(--gg-primary)] bg-[var(--gg-primary)]' : 'border-gray-300'
                                          }`}>
                                            {isSelected && (
                                              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                              </svg>
                                            )}
                                          </div>
                                          <span>{option}</span>
                                        </div>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}

                              {/* Ranking */}
                              {config.type === 'ranking' && (
                                <div className="space-y-2">
                                  <p className="text-xs text-gray-500 mb-2">
                                    Use arrows to rank by importance (#1 is most important)
                                  </p>
                                  {(editValue as string[]).map((option, index) => (
                                    <div
                                      key={option}
                                      className="flex items-center gap-2 rounded-lg border-2 border-gray-200 bg-white p-3"
                                    >
                                      <div className="flex flex-col gap-0.5">
                                        <button
                                          onClick={() => handleRanking('up', index)}
                                          disabled={index === 0}
                                          className={`rounded p-0.5 ${
                                            index === 0
                                              ? 'text-gray-300 cursor-not-allowed'
                                              : 'text-[var(--gg-primary)] hover:bg-gray-100'
                                          }`}
                                        >
                                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => handleRanking('down', index)}
                                          disabled={index === (editValue as string[]).length - 1}
                                          className={`rounded p-0.5 ${
                                            index === (editValue as string[]).length - 1
                                              ? 'text-gray-300 cursor-not-allowed'
                                              : 'text-[var(--gg-primary)] hover:bg-gray-100'
                                          }`}
                                        >
                                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>
                                      </div>
                                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--gg-primary)] text-white font-semibold text-xs">
                                        {index + 1}
                                      </div>
                                      <span className="text-sm flex-1">{option}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Removable List */}
                              {config.type === 'removable-list' && (
                                <div className="space-y-2">
                                  <p className="text-xs text-gray-500 mb-2">
                                    Click the × button to remove ingredients
                                  </p>
                                  {(editValue as string[]).length > 0 ? (
                                    <div className="space-y-2">
                                      {(editValue as string[]).map((item) => (
                                        <div
                                          key={item}
                                          className="flex items-center justify-between gap-3 rounded-lg border-2 border-gray-200 bg-white p-3"
                                        >
                                          <span className="text-sm flex-1">{capitalizeWords(item)}</span>
                                          <button
                                            onClick={() => handleRemoveItem(item)}
                                            className="flex-shrink-0 rounded-full p-1 text-red-500 hover:bg-red-50 transition-colors"
                                            title="Remove"
                                          >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center">
                                      <p className="text-sm text-gray-500">No items to display</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Save/Cancel Buttons */}
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={() => handleEditSave(questionId)}
                                  disabled={isSaving}
                                  className="gg-btn-primary flex-1 text-sm py-2"
                                >
                                  {isSaving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={handleEditCancel}
                                  disabled={isSaving}
                                  className="gg-btn-outline flex-1 text-sm py-2"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
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


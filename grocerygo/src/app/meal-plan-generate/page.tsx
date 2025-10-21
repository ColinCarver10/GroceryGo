'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { generateMealPlanFromPreferences, replaceExistingMealPlan } from '@/app/meal-plan-generate/actions'

const daysOfWeek = [
  { short: 'Mon', full: 'Monday' },
  { short: 'Tue', full: 'Tuesday' },
  { short: 'Wed', full: 'Wednesday' },
  { short: 'Thu', full: 'Thursday' },
  { short: 'Fri', full: 'Friday' },
  { short: 'Sat', full: 'Saturday' },
  { short: 'Sun', full: 'Sunday' },
]

type MealType = 'breakfast' | 'lunch' | 'dinner'

interface MealSelections {
  [key: string]: {
    breakfast: boolean
    lunch: boolean
    dinner: boolean
  }
}

export default function MealPlanGeneratePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showReplaceDialog, setShowReplaceDialog] = useState(false)
  const [conflictData, setConflictData] = useState<{
    existingPlanId: string
    weekOf: string
  } | null>(null)

  // Initialize with all meals selected
  const [selections, setSelections] = useState<MealSelections>(
    daysOfWeek.reduce((acc, day) => ({
      ...acc,
      [day.full]: { breakfast: true, lunch: true, dinner: true }
    }), {})
  )

  const toggleMeal = (day: string, mealType: MealType) => {
    setSelections(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [mealType]: !prev[day][mealType]
      }
    }))
  }

  const toggleAllForDay = (day: string) => {
    const allSelected = selections[day].breakfast && selections[day].lunch && selections[day].dinner
    setSelections(prev => ({
      ...prev,
      [day]: {
        breakfast: !allSelected,
        lunch: !allSelected,
        dinner: !allSelected
      }
    }))
  }

  const toggleAllForMealType = (mealType: MealType) => {
    const allSelected = daysOfWeek.every(day => selections[day.full][mealType])
    setSelections(prev => {
      const newSelections = { ...prev }
      daysOfWeek.forEach(day => {
        newSelections[day.full] = {
          ...newSelections[day.full],
          [mealType]: !allSelected
        }
      })
      return newSelections
    })
  }

  const getTotalMeals = () => {
    let breakfast = 0, lunch = 0, dinner = 0
    Object.values(selections).forEach(day => {
      if (day.breakfast) breakfast++
      if (day.lunch) lunch++
      if (day.dinner) dinner++
    })
    return { breakfast, lunch, dinner, total: breakfast + lunch + dinner }
  }

  const handleGenerate = async () => {
    const totals = getTotalMeals()
    
    if (totals.total === 0) {
      setError('Please select at least one meal to generate')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Get next Monday as the week start
      const today = new Date()
      const nextMonday = new Date(today)
      nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7))
      const weekOf = nextMonday.toISOString().split('T')[0]

      const result = await generateMealPlanFromPreferences(weekOf, {
        breakfast: totals.breakfast,
        lunch: totals.lunch,
        dinner: totals.dinner
      })

      // Check if there's a conflict (existing meal plan)
      if ((result as any).conflict) {
        setConflictData({
          existingPlanId: (result as any).existingPlanId,
          weekOf: (result as any).weekOf
        })
        setShowReplaceDialog(true)
        setLoading(false)
        return
      }

      if (result.error) {
        if (result.needsSurvey) {
          setError(result.error)
          setTimeout(() => router.push('/onboarding'), 2000)
        } else {
          setError(result.error)
        }
      } else if (result.saved) {
        setSuccess(true)
      } else {
        setError('Failed to save meal plan. Please try again.')
      }
    } catch (err) {
      console.error('Generation error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReplace = async () => {
    if (!conflictData) return

    const totals = getTotalMeals()
    
    setLoading(true)
    setError('')
    setSuccess(false)
    setShowReplaceDialog(false)

    try {
      const result = await replaceExistingMealPlan(
        conflictData.existingPlanId,
        conflictData.weekOf,
        {
          breakfast: totals.breakfast,
          lunch: totals.lunch,
          dinner: totals.dinner
        }
      )

      if (result.error) {
        if (result.needsSurvey) {
          setError(result.error)
          setTimeout(() => router.push('/onboarding'), 2000)
        } else {
          setError(result.error)
        }
      } else if (result.saved) {
        setSuccess(true)
        setConflictData(null)
      } else {
        setError('Failed to save meal plan. Please try again.')
      }
    } catch (err) {
      console.error('Replacement error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelReplace = () => {
    setShowReplaceDialog(false)
    setConflictData(null)
  }

  const totals = getTotalMeals()

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
            <h1 className="gg-heading-page mb-2">Generate Meal Plan</h1>
            <p className="gg-text-subtitle">
              Select the meals you&apos;d like us to plan for you this week
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            
            {/* Main Content - Meal Selector */}
            <div className="lg:col-span-2">
              <div className="gg-card">
                <h2 className="gg-heading-section mb-6">Select Your Meals</h2>

                {/* Meal Type Headers */}
                <div className="flex items-center gap-4 mb-3 px-3">
                  <div className="w-24"></div>
                  <div className="flex items-center gap-6 flex-1">
                    <button
                      onClick={() => toggleAllForMealType('breakfast')}
                      className="text-center text-sm font-semibold text-gray-700 hover:text-[var(--gg-primary)] transition-colors flex-1"
                    >
                      🍳 Breakfast
                    </button>
                    <button
                      onClick={() => toggleAllForMealType('lunch')}
                      className="text-center text-sm font-semibold text-gray-700 hover:text-[var(--gg-primary)] transition-colors flex-1"
                    >
                      🥗 Lunch
                    </button>
                    <button
                      onClick={() => toggleAllForMealType('dinner')}
                      className="text-center text-sm font-semibold text-gray-700 hover:text-[var(--gg-primary)] transition-colors flex-1"
                    >
                      🍽️ Dinner
                    </button>
                  </div>
                </div>

                {/* Day Rows */}
                <div className="space-y-2">
                  {daysOfWeek.map((day) => (
                    <div 
                      key={day.full}
                      className="flex items-center gap-4 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <button
                        onClick={() => toggleAllForDay(day.full)}
                        className="text-sm font-medium text-gray-900 text-left hover:text-[var(--gg-primary)] transition-colors w-24"
                      >
                        {day.full}
                      </button>
                      
                      <div className="flex items-center gap-6 flex-1">
                        {(['breakfast', 'lunch', 'dinner'] as MealType[]).map((mealType) => (
                          <label
                            key={mealType}
                            className="flex items-center justify-center cursor-pointer flex-1"
                          >
                            <input
                              type="checkbox"
                              checked={selections[day.full][mealType]}
                              onChange={() => toggleMeal(day.full, mealType)}
                              className="gg-checkbox"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Actions */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-3">Quick actions:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const allSelected = Object.values(selections).every(
                          day => day.breakfast && day.lunch && day.dinner
                        )
                        setSelections(
                          daysOfWeek.reduce((acc, day) => ({
                            ...acc,
                            [day.full]: { breakfast: !allSelected, lunch: !allSelected, dinner: !allSelected }
                          }), {})
                        )
                      }}
                      className="gg-btn-outline text-sm py-2 px-4"
                    >
                      Toggle All
                    </button>
                    <button
                      onClick={() => {
                        setSelections(
                          daysOfWeek.reduce((acc, day) => ({
                            ...acc,
                            [day.full]: { 
                              breakfast: false, 
                              lunch: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day.full), 
                              dinner: true 
                            }
                          }), {})
                        )
                      }}
                      className="gg-btn-outline text-sm py-2 px-4"
                    >
                      Weekday Lunches Only
                    </button>
                    <button
                      onClick={() => {
                        setSelections(
                          daysOfWeek.reduce((acc, day) => ({
                            ...acc,
                            [day.full]: { breakfast: false, lunch: false, dinner: true }
                          }), {})
                        )
                      }}
                      className="gg-btn-outline text-sm py-2 px-4"
                    >
                      Dinners Only
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar - Summary & Generate */}
            <div className="space-y-6">
              
              {/* Summary Card */}
              <div className="gg-card">
                <h2 className="gg-heading-section mb-6">Meal Summary</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🍳</span>
                      <span className="gg-text-body">Breakfasts</span>
                    </div>
                    <span className="text-2xl font-bold text-[var(--gg-primary)]">
                      {totals.breakfast}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🥗</span>
                      <span className="gg-text-body">Lunches</span>
                    </div>
                    <span className="text-2xl font-bold text-[var(--gg-primary)]">
                      {totals.lunch}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🍽️</span>
                      <span className="gg-text-body">Dinners</span>
                    </div>
                    <span className="text-2xl font-bold text-[var(--gg-primary)]">
                      {totals.dinner}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 bg-opacity-10 rounded-lg px-4">
                    <span className="font-semibold text-gray-900 text-2xl">Total Meals</span>
                    <span className="text-3xl font-bold text-[var(--gg-primary)]">
                      {totals.total}
                    </span>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={loading || totals.total === 0}
                className={`gg-btn-primary w-full flex items-center justify-center gap-2 ${
                  (loading || totals.total === 0) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
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
                    Generating Your Meal Plan...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate Meal Plan
                  </>
                )}
              </button>

              {/* Info Card */}
              <div className="gg-card bg-blue-50 border-blue-200">
                <div className="flex gap-3">
                  <svg className="h-6 w-6 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">
                      Personalized for You
                    </p>
                    <p className="text-sm text-blue-800">
                      We&apos;ll use your survey preferences to create a customized meal plan that fits your dietary needs, budget, and cooking style.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">
                <span className="font-semibold">Error: </span>
                {error}
              </p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mt-6 p-6 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-green-900 font-semibold text-lg">
                      Meal Plan Created Successfully!
                    </p>
                    <p className="text-green-800 text-sm mt-1">
                      Your {totals.total} meals are ready to view with recipes and shopping list.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="gg-btn-primary"
                >
                  View Dashboard
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Replace Meal Plan Dialog */}
      {showReplaceDialog && (
        <>
          <div className="fixed inset-0 z-50 bg-black opacity-30" onClick={handleCancelReplace} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 pointer-events-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Meal Plan Already Exists
              </h3>
              <p className="text-gray-600 mb-6">
                You already have a meal plan for this week. Would you like to replace it with a new one?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCancelReplace}
                  disabled={loading}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReplace}
                  disabled={loading}
                  className="gg-btn-primary disabled:opacity-50"
                >
                  {loading ? 'Replacing...' : 'Replace Meal Plan'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

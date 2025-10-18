'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { MealPlanWithRecipes } from '@/types/database'

interface DashboardClientProps {
  surveyResponse: Record<string, any> | null
  mealPlans: MealPlanWithRecipes[]
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

export default function DashboardClient({ surveyResponse, mealPlans }: DashboardClientProps) {
  const [showSurveyDropdown, setShowSurveyDropdown] = useState(false)

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
              <button className="gg-btn-primary flex items-center gap-2">
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

              {/* Quick Actions Card */}
              <div className="gg-card">
                <h2 className="gg-heading-section mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <Link href="/meal-plan-generate" className="block">
                    <button className="w-full rounded-xl border-2 border-gray-200 p-3 text-left transition-all hover:border-[var(--gg-primary)] hover:bg-[var(--gg-primary)] hover:bg-opacity-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--gg-primary)] bg-opacity-10">
                          <svg className="h-5 w-5 text-[var(--gg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Generate Meal Plan</p>
                          <p className="text-xs text-gray-600">Create personalized meals</p>
                        </div>
                      </div>
                    </button>
                  </Link>
                  
                  <button className="w-full rounded-xl border-2 border-gray-200 p-3 text-left transition-all hover:border-[var(--gg-primary)] hover:bg-[var(--gg-primary)] hover:bg-opacity-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--gg-primary)] bg-opacity-10">
                        <svg className="h-5 w-5 text-[var(--gg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Shopping List</p>
                        <p className="text-xs text-gray-600">View current list</p>
                      </div>
                    </div>
                  </button>
                  
                  <button className="w-full rounded-xl border-2 border-gray-200 p-3 text-left transition-all hover:border-[var(--gg-primary)] hover:bg-[var(--gg-primary)] hover:bg-opacity-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--gg-primary)] bg-opacity-10">
                        <svg className="h-5 w-5 text-[var(--gg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Favorites</p>
                        <p className="text-xs text-gray-600">Your saved recipes</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}


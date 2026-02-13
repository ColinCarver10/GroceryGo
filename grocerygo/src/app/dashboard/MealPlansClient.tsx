'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { MealPlanWithRecipes } from '@/types/database'
import Pagination from '@/components/Pagination'
import MealPlanCardSkeleton from '@/components/MealPlanCardSkeleton'
import GeneratingMealPlanModal from '@/components/GeneratingMealPlanModal'
import { getPaginatedMealPlans } from './actions'

interface MealPlansClientProps {
  mealPlans: MealPlanWithRecipes[]
  totalMealPlans: number
  currentPage: number
  pageSize: number
}

export default function MealPlansClient({
  mealPlans: initialMealPlans,
  totalMealPlans: initialTotal,
  currentPage: initialPage,
  pageSize,
}: MealPlansClientProps) {
  const router = useRouter()
  const [mealPlans, setMealPlans] = useState(initialMealPlans)
  const [totalMealPlans, setTotalMealPlans] = useState(initialTotal)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [generatingModalPlanId, setGeneratingModalPlanId] = useState<string | null>(null)

  const formatWeekOf = (weekStr: string) => {
    if (weekStr.includes('-')) return weekStr
    const date = new Date(weekStr)
    return date.toLocaleDateString()
  }

  const handlePageChange = async (page: number) => {
    setIsLoadingPage(true)
    try {
      const result = await getPaginatedMealPlans(page, pageSize)
      if (result.success) {
        setMealPlans(result.mealPlans)
        setTotalMealPlans(result.totalMealPlans)
        setCurrentPage(result.currentPage)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (error) {
      console.error('Error loading page:', error)
    } finally {
      setIsLoadingPage(false)
    }
  }

  const handleMealPlanClick = (e: React.MouseEvent, plan: MealPlanWithRecipes) => {
    if (plan.status === 'generating') {
      e.preventDefault()
      setGeneratingModalPlanId(plan.id)
    }
  }

  const handleGenerationComplete = () => {
    router.refresh()
  }

  const handleCloseGeneratingModal = () => {
    setGeneratingModalPlanId(null)
  }

  return (
    <>
      <div className="gg-card">
        <h2 className="gg-heading-section mb-6">Previous Meal Plans</h2>
        
        {isLoadingPage ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <MealPlanCardSkeleton key={i} />
            ))}
          </div>
        ) : mealPlans.length > 0 ? (
          <>
            <div className="space-y-4">
              {mealPlans.map((plan) => {
                return (
                  <Link 
                    key={plan.id}
                    href={plan.status === 'generating' ? '#' : `/meal-plan/${plan.id}`}
                    onClick={(e) => handleMealPlanClick(e, plan)}
                    className="block group rounded-xl border-2 border-gray-200 bg-white p-4 sm:p-6 transition-all hover:border-[var(--gg-primary)] hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                          <h3 className="gg-heading-card text-base sm:text-xl">Week of {formatWeekOf(plan.week_of)}</h3>
                          <span className={`rounded-full px-2 sm:px-3 py-1 text-xs font-medium whitespace-nowrap ${
                            plan.status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : plan.status === 'in-progress'
                              ? 'bg-blue-100 text-blue-800'
                              : plan.status === 'generating'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {plan.status === 'completed' ? 'Completed' : 
                             plan.status === 'in-progress' ? 'In Progress' :
                             plan.status === 'generating' ? 'Generating...' : 'Pending'}
                          </span>
                        </div>
                        
                        <div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{new Date(plan.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                            </svg>
                            <span>{plan.total_meals} meals</span>
                          </div>
                        </div>

                        <div className="text-xs sm:text-sm text-gray-600">
                          <span className="hidden sm:inline">Click to view recipes and shopping list →</span>
                          <span className="sm:hidden">Tap to view →</span>
                        </div>
                      </div>

                      <svg 
                        className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-[var(--gg-primary)] flex-shrink-0" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                )
              })}
            </div>
            
            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalMealPlans / pageSize)}
              onPageChange={handlePageChange}
            />
          </>
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

      {/* Generating Meal Plan Modal */}
      {generatingModalPlanId && (
        <GeneratingMealPlanModal
          mealPlanId={generatingModalPlanId}
          isOpen={!!generatingModalPlanId}
          onClose={handleCloseGeneratingModal}
          onGenerationComplete={handleGenerationComplete}
        />
      )}
    </>
  )
}

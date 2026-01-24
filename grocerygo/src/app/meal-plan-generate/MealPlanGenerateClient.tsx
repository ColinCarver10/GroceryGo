'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  generateMealPlanFromPreferences,
  replaceExistingMealPlan,
  type GenerateMealPlanResponse,
  type GenerateMealPlanConflict,
  type GenerateMealPlanError
} from '@/app/meal-plan-generate/actions'
import type { SurveyResponse } from '@/types/database'

type MealType = 'breakfast' | 'lunch' | 'dinner'

interface MealSelections {
  [key: string]: {
    breakfast: boolean
    lunch: boolean
    dinner: boolean
  }
}

interface DistinctCounts {
  breakfast: number
  lunch: number
  dinner: number
}

interface MealSlot {
  day: string
  mealType: MealType
  id: string
  mealNumber: number
}

interface MealPlanGenerateClientProps {
  surveyResponse: SurveyResponse
}

function isErrorResponse(response: GenerateMealPlanResponse): response is GenerateMealPlanError {
  return 'error' in response
}

function deriveBaseDistinct(totalSlots: number, surveyResponse?: SurveyResponse) {
  if (totalSlots === 0) return 0

  // Check user preferences to bias toward lower variety (batch cooking)
  const priorities = surveyResponse?.['11'] as string[] | undefined
  const goals = surveyResponse?.['9'] as string[] | undefined
  const budget = surveyResponse?.['3'] as string | undefined

  // Strong bias toward batch cooking if budget-conscious or time-saving
  const isBudgetConscious = budget === '$50-100' || 
    (priorities && priorities[0] === 'Cost efficiency') ||
    (goals && goals.includes('Save money on groceries'))
  
  const isTimeSaving = priorities && priorities[0] === 'Time saving'

  if (isBudgetConscious || isTimeSaving) {
    // Very low variety: 1-2 recipes
    return Math.max(1, Math.min(2, Math.ceil(totalSlots / 4)))
  }

  // Default: moderate variety (~50% of total)
  return Math.max(1, Math.ceil(totalSlots / 2))
}

function clampDistinctCounts(
  counts: DistinctCounts,
  totals: { breakfast: number; lunch: number; dinner: number }
): DistinctCounts {
  return {
    breakfast: Math.min(Math.max(counts.breakfast, totals.breakfast === 0 ? 0 : 1), Math.max(totals.breakfast, 0)),
    lunch: Math.min(Math.max(counts.lunch, totals.lunch === 0 ? 0 : 1), Math.max(totals.lunch, 0)),
    dinner: Math.min(Math.max(counts.dinner, totals.dinner === 0 ? 0 : 1), Math.max(totals.dinner, 0))
  }
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

function getDaysForWeek(startDateStr: string): Array<{ dayName: string; dateStr: string; dateDisplay: string }> {
  if (!startDateStr) return []
  
  const [year, month, day] = startDateStr.split('-').map(Number)
  const startDate = new Date(year, month - 1, day)
  const result: Array<{ dayName: string; dateStr: string; dateDisplay: string }> = []
  
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + i)
    
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' })
    const dateDisplay = formatDateForDisplay(dateStr)
    
    result.push({ dayName, dateStr, dateDisplay })
  }
  
  return result
}

function validateStartDate(dateStr: string): string {
  if (!dateStr) {
    return 'Please select a start date'
  }
  
  const selectedDate = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  if (selectedDate < today) {
    return 'Start date must be today or in the future'
  }
  
  return ''
}

function getDayShortName(dayName: string): string {
  const dayMap: { [key: string]: string } = {
    'Monday': 'Mon',
    'Tuesday': 'Tue',
    'Wednesday': 'Wed',
    'Thursday': 'Thu',
    'Friday': 'Fri',
    'Saturday': 'Sat',
    'Sunday': 'Sun'
  }
  return dayMap[dayName] || dayName.substring(0, 3)
}

// Auto-distribute meals to recipes evenly
function autoDistributeMeals(
  mealSlots: MealSlot[],
  mealType: MealType,
  recipeCount: number
): Map<string, number> {
  const slotsForType = mealSlots.filter(s => s.mealType === mealType)
  const assignments = new Map<string, number>()
  
  if (slotsForType.length === 0 || recipeCount === 0) return assignments
  
  // Distribute evenly, preferring consecutive days together
  const slotsPerRecipe = Math.ceil(slotsForType.length / recipeCount)
  
  slotsForType.forEach((slot, index) => {
    const recipeIndex = Math.min(
      Math.floor(index / slotsPerRecipe),
      recipeCount - 1
    )
    assignments.set(slot.id, recipeIndex)
  })
  
  return assignments
}

// Calculate time and money savings from batch cooking
function calculateSavings(currentRecipes: number, maxRecipes: number) {
  const recipesReduced = maxRecipes - currentRecipes
  return {
    timeSavedMinutes: recipesReduced * 40, // ~40 min per recipe
    moneySaved: recipesReduced * 8 // ~$8 saved per recipe reduced
  }
}

function formatTimeSaved(minutes: number): string {
  if (minutes <= 0) return ''
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  if (hours === Math.floor(hours)) return `${hours} hr${hours > 1 ? 's' : ''}`
  return `${hours.toFixed(1)} hrs`
}

// Tappable Meal Chip Component
function MealChip({ 
  mealSlot, 
  isSelected, 
  onTap 
}: { 
  mealSlot: MealSlot
  isSelected: boolean
  onTap: () => void
}) {
  return (
    <button
      onClick={onTap}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        isSelected
          ? 'bg-[var(--gg-primary)] text-white ring-2 ring-[var(--gg-primary)] ring-offset-2'
          : 'bg-white border border-gray-200 text-gray-900 hover:border-[var(--gg-primary)] hover:shadow-sm'
      }`}
    >
      {getDayShortName(mealSlot.day)}
    </button>
  )
}

// Recipe Box Component - tappable target
function RecipeBox({
  recipeIndex,
  mealType,
  assignedSlots,
  selectedMealId,
  hasSelectedMeal,
  onMealTap,
  onBoxTap,
}: {
  recipeIndex: number
  mealType: MealType
  assignedSlots: MealSlot[]
  selectedMealId: string | null
  hasSelectedMeal: boolean
  onMealTap: (mealSlotId: string) => void
  onBoxTap: () => void
}) {
  const isTargetable = hasSelectedMeal && !assignedSlots.some(s => s.id === selectedMealId)

  return (
    <div
      onClick={isTargetable ? onBoxTap : undefined}
      className={`border-2 rounded-xl p-4 transition-all bg-gray-50 ${
        isTargetable
          ? 'border-[var(--gg-primary)] cursor-pointer'
          : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-900">Recipe {recipeIndex + 1}</h4>
        {isTargetable && (
          <span className="text-xs text-[var(--gg-primary)] font-medium">Tap to move here</span>
        )}
      </div>

      <div className="min-h-[44px]">
        {assignedSlots.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {assignedSlots.map(slot => (
              <MealChip
                key={slot.id}
                mealSlot={slot}
                isSelected={selectedMealId === slot.id}
                onTap={() => onMealTap(slot.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No meals assigned</p>
        )}
      </div>
    </div>
  )
}

// Meal Type Slider Card Component
function MealTypeSliderCard({
  mealType,
  mealSlots,
  recipeCount,
  recommendedCount,
  mealAssignments,
  selectedMealId,
  onSliderChange,
  onMealTap,
  onRecipeBoxTap,
}: {
  mealType: MealType
  mealSlots: MealSlot[]
  recipeCount: number
  recommendedCount: number
  mealAssignments: Map<string, number>
  selectedMealId: string | null
  onSliderChange: (value: number) => void
  onMealTap: (mealSlotId: string) => void
  onRecipeBoxTap: (mealType: MealType, recipeIndex: number) => void
}) {
  const slotsForType = mealSlots.filter(s => s.mealType === mealType)
  const totalMeals = slotsForType.length
  const mealEmoji = mealType === 'breakfast' ? '🍳' : mealType === 'lunch' ? '🥗' : '🍽️'

  // Group slots by recipe index
  const recipeGroups: MealSlot[][] = []
  for (let i = 0; i < recipeCount; i++) {
    recipeGroups[i] = slotsForType.filter(slot => mealAssignments.get(slot.id) === i)
  }

  // Check if any meal of this type is selected
  const hasSelectedMealOfType = selectedMealId !== null && 
    slotsForType.some(s => s.id === selectedMealId)

  if (totalMeals === 0) return null

  return (
    <div className="mb-8 last:mb-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{mealEmoji}</span>
          <h3 className="text-xl font-bold text-gray-900 capitalize">{mealType}</h3>
        </div>
        <span className="text-sm text-gray-500">
          {totalMeals} meal{totalMeals === 1 ? '' : 's'}
        </span>
      </div>

      {/* Slider Section */}
      {totalMeals > 1 && (() => {
        const savings = calculateSavings(recipeCount, totalMeals)
        const timeSavedFormatted = formatTimeSaved(savings.timeSavedMinutes)
        
        return (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2 px-1">
              <label className="text-sm font-medium text-gray-700">Unique Recipes</label>
              <span className="text-lg font-bold text-[var(--gg-primary)]">{recipeCount}</span>
            </div>

            {/* Recommended Indicator - Always visible with arrow pointing down */}
            <div className="relative h-8 mb-1">
              <div 
                className="absolute transition-all duration-200"
                style={{ 
                  left: `calc(${((recommendedCount - 1) / (totalMeals - 1)) * 100}% + 12px - ${((recommendedCount - 1) / (totalMeals - 1)) * 12}px)`,
                  transform: 'translateX(-50%)'
                }}
              >
                <div className="flex flex-col items-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                    recipeCount === recommendedCount 
                      ? 'bg-[var(--gg-primary)] text-white' 
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}>
                    ✨ Recommended
                  </span>
                  <svg className="w-3 h-3 text-[var(--gg-primary)] -mt-0.5" viewBox="0 0 12 8" fill="currentColor">
                    <path d="M6 8L0 0H12L6 8Z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="relative px-1">
              <input
                type="range"
                min={1}
                max={totalMeals}
                value={recipeCount}
                onChange={(e) => onSliderChange(parseInt(e.target.value, 10))}
                className="gg-slider w-full"
              />
              
              {/* Slider Labels */}
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>Batch Cook</span>
                <span>Max Variety</span>
              </div>
            </div>

            {/* Savings Badges */}
            {recipeCount < totalMeals && (
              <div className="flex items-center justify-center gap-4 mt-3">
                <span className="text-sm text-green-600 font-medium">
                  💰 Save ~${savings.moneySaved}
                </span>
                {timeSavedFormatted && (
                  <span className="text-sm text-blue-600 font-medium">
                    ⏱️ Save ~{timeSavedFormatted}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Recipe Boxes */}
      <div className="space-y-3">
        {recipeGroups.map((slots, index) => (
          <RecipeBox
            key={`${mealType}-recipe-${index}`}
            recipeIndex={index}
            mealType={mealType}
            assignedSlots={slots}
            selectedMealId={selectedMealId}
            hasSelectedMeal={hasSelectedMealOfType}
            onMealTap={onMealTap}
            onBoxTap={() => onRecipeBoxTap(mealType, index)}
          />
        ))}
      </div>

      {/* Helper Text */}
      {totalMeals > 1 && (
        <p className="mt-3 text-xs text-gray-500 text-center">
          💡 Tap a day to select, then tap a recipe box to move it
        </p>
      )}
    </div>
  )
}

export default function MealPlanGenerateClient({ surveyResponse }: MealPlanGenerateClientProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showReplaceDialog, setShowReplaceDialog] = useState(false)
  const [conflictData, setConflictData] = useState<Pick<GenerateMealPlanConflict, 'existingPlanId' | 'weekOf'> | null>(null)
  const [startDate, setStartDate] = useState<string>('')
  const [dateError, setDateError] = useState('')
  const headerDescriptionRef = useRef<HTMLDivElement>(null)

  // Tap-to-swap state
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null)

  // Calculate days for the week based on start date
  const weekDays = useMemo(() => {
    if (!startDate) return []
    return getDaysForWeek(startDate)
  }, [startDate])

  // Initialize with all meals selected - will be updated when startDate changes
  const [selections, setSelections] = useState<MealSelections>({})

  // Update selections when startDate changes
  useEffect(() => {
    if (startDate && weekDays.length > 0) {
      const newSelections: MealSelections = {}
      weekDays.forEach(({ dayName }) => {
        newSelections[dayName] = { breakfast: false, lunch: false, dinner: false }
      })
      setSelections(newSelections)
    } else {
      setSelections({})
    }
  }, [startDate, weekDays])

  const totals = useMemo(() => {
    let breakfast = 0
    let lunch = 0
    let dinner = 0

    Object.values(selections).forEach(day => {
      if (day.breakfast) breakfast += 1
      if (day.lunch) lunch += 1
      if (day.dinner) dinner += 1
    })

    return {
      breakfast,
      lunch,
      dinner,
      total: breakfast + lunch + dinner
    }
  }, [selections])

  const selectedSlots = useMemo(
    () =>
      weekDays.flatMap(({ dayName }) =>
        (['breakfast', 'lunch', 'dinner'] as MealType[]).reduce<Array<{ day: string; mealType: MealType }>>(
          (acc, mealType) => {
            if (selections[dayName]?.[mealType]) {
              acc.push({ day: dayName, mealType })
            }
            return acc
          },
          []
        )
      ),
    [selections, weekDays]
  )

  // Convert selectedSlots to MealSlot format with IDs and permanent meal numbers
  const mealSlots = useMemo<MealSlot[]>(() => {
    // Count meals by type to assign permanent numbers
    const mealCounts: Record<MealType, number> = {
      breakfast: 0,
      lunch: 0,
      dinner: 0
    }

    return selectedSlots.map((slot) => {
      mealCounts[slot.mealType] += 1
      return {
        ...slot,
        id: `${slot.day}-${slot.mealType}-${mealCounts[slot.mealType]}`,
        mealNumber: mealCounts[slot.mealType]
      }
    })
  }, [selectedSlots])

  // Recipe count state (slider values)
  const [recipeCount, setRecipeCount] = useState<DistinctCounts>(() => ({
    breakfast: deriveBaseDistinct(totals.breakfast, surveyResponse),
    lunch: deriveBaseDistinct(totals.lunch, surveyResponse),
    dinner: deriveBaseDistinct(totals.dinner, surveyResponse)
  }))

  // Recommended counts (smart defaults)
  const recommendedCounts = useMemo<DistinctCounts>(() => ({
    breakfast: deriveBaseDistinct(totals.breakfast, surveyResponse),
    lunch: deriveBaseDistinct(totals.lunch, surveyResponse),
    dinner: deriveBaseDistinct(totals.dinner, surveyResponse)
  }), [totals.breakfast, totals.lunch, totals.dinner, surveyResponse])

  // Meal assignments: maps mealSlotId to recipeIndex
  const [mealAssignments, setMealAssignments] = useState<Map<string, number>>(new Map())

  // Update recipe counts when totals change
  useEffect(() => {
    setRecipeCount(prev =>
      clampDistinctCounts(prev, {
        breakfast: totals.breakfast,
        lunch: totals.lunch,
        dinner: totals.dinner
      })
    )
  }, [totals.breakfast, totals.lunch, totals.dinner])

  // Auto-distribute meals when recipe count or meal slots change
  useEffect(() => {
    const newAssignments = new Map<string, number>()
    
    ;(['breakfast', 'lunch', 'dinner'] as MealType[]).forEach(mealType => {
      const typeAssignments = autoDistributeMeals(mealSlots, mealType, recipeCount[mealType])
      typeAssignments.forEach((value, key) => {
        newAssignments.set(key, value)
      })
    })
    
    setMealAssignments(newAssignments)
  }, [mealSlots, recipeCount])

  // Reset selection when step changes
  useEffect(() => {
    if (currentStep === 1) {
      setSelectedMealId(null)
    }
  }, [currentStep])

  // Sync recipeCount to recommended values when entering Step 2
  useEffect(() => {
    if (currentStep === 2) {
      setRecipeCount({
        breakfast: deriveBaseDistinct(totals.breakfast, surveyResponse),
        lunch: deriveBaseDistinct(totals.lunch, surveyResponse),
        dinner: deriveBaseDistinct(totals.dinner, surveyResponse)
      })
    }
  }, [currentStep, totals.breakfast, totals.lunch, totals.dinner, surveyResponse])

  // Scroll to header description when moving to step 2
  useEffect(() => {
    if (currentStep === 2 && headerDescriptionRef.current) {
      headerDescriptionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [currentStep])

  const toggleMeal = (day: string, mealType: MealType) => {
    setSelections(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [mealType]: !prev[day][mealType]
      }
    }))
  }

  const handleDateChange = (dateStr: string) => {
    setStartDate(dateStr)
    const validationError = validateStartDate(dateStr)
    setDateError(validationError)
  }

  const handleNext = () => {
    if (totals.total === 0) {
      setError('Please select at least one meal to continue')
      return
    }
    setCurrentStep(2)
    setError('')
  }

  const handleBack = () => {
    setCurrentStep(1)
    setError('')
  }

  // Slider change handler
  const handleSliderChange = useCallback((mealType: MealType, value: number) => {
    setRecipeCount(prev => {
      const updated = { ...prev, [mealType]: value }
      return clampDistinctCounts(updated, {
        breakfast: totals.breakfast,
        lunch: totals.lunch,
        dinner: totals.dinner
      })
    })
    // Clear selection when slider changes
    setSelectedMealId(null)
  }, [totals.breakfast, totals.lunch, totals.dinner])

  // Tap-to-swap handlers
  const handleMealTap = useCallback((mealSlotId: string) => {
    setSelectedMealId(prev => prev === mealSlotId ? null : mealSlotId)
  }, [])

  const handleRecipeBoxTap = useCallback((mealType: MealType, targetRecipeIndex: number) => {
    if (!selectedMealId) return

    const selectedSlot = mealSlots.find(s => s.id === selectedMealId)
    if (!selectedSlot || selectedSlot.mealType !== mealType) return

    // Move the selected meal to the target recipe
    setMealAssignments(prev => {
      const next = new Map(prev)
      next.set(selectedMealId, targetRecipeIndex)
      return next
    })

    // Clear selection
    setSelectedMealId(null)
  }, [selectedMealId, mealSlots])

  const handleGenerate = async () => {
    if (!startDate) {
      setError('Please select a start date')
      return
    }

    const validationError = validateStartDate(startDate)
    if (validationError) {
      setDateError(validationError)
      setError(validationError)
      return
    }

    if (totals.total === 0) {
      setError('Please select at least one meal to generate')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)
    setDateError('')

    try {
      const weekOf = startDate

      const result = await generateMealPlanFromPreferences(
        weekOf,
        {
          breakfast: totals.breakfast,
          lunch: totals.lunch,
          dinner: totals.dinner
        },
        recipeCount,
        selectedSlots
      )

      if ('conflict' in result && result.conflict) {
        setConflictData({
          existingPlanId: result.existingPlanId,
          weekOf: result.weekOf
        })
        setShowReplaceDialog(true)
        setLoading(false)
        return
      }

      if (isErrorResponse(result)) {
        const { error: message, needsSurvey } = result
        setError(message)
        if (needsSurvey) {
          setTimeout(() => router.push('/onboarding'), 2000)
        }
        setLoading(false)
      } else if (result.success) {
        router.push(`/meal-plan/generating/${result.mealPlanId}`)
      } else {
        setError('Failed to create meal plan. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleReplace = async () => {
    if (!conflictData) return

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
        },
        recipeCount,
        selectedSlots
      )

      if (isErrorResponse(result)) {
        const { error: message, needsSurvey } = result
        setError(message)
        if (needsSurvey) {
          setTimeout(() => router.push('/onboarding'), 2000)
        }
        setLoading(false)
      } else if (result.success) {
        router.push(`/meal-plan/generating/${result.mealPlanId}`)
      } else {
        setError('Failed to create meal plan. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleCancelReplace = () => {
    setShowReplaceDialog(false)
    setConflictData(null)
  }

  // Meal Summary Component
  const MealSummary = () => {
    return (
      <div className="gg-card">
        <h2 className="gg-heading-section mb-6">Meal Summary</h2>
        <div className="space-y-4">
          <div className="py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🍳</span>
                <span className="gg-text-body">Breakfasts</span>
              </div>
              <span className="text-2xl font-bold text-[var(--gg-primary)]">
                {totals.breakfast}
              </span>
            </div>
            {totals.breakfast > 0 && (
              <div className="text-sm text-gray-600 ml-9">
                {recipeCount.breakfast} unique recipe{recipeCount.breakfast !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <div className="py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🥗</span>
                <span className="gg-text-body">Lunches</span>
              </div>
              <span className="text-2xl font-bold text-[var(--gg-primary)]">
                {totals.lunch}
              </span>
            </div>
            {totals.lunch > 0 && (
              <div className="text-sm text-gray-600 ml-9">
                {recipeCount.lunch} unique recipe{recipeCount.lunch !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <div className="py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🍽️</span>
                <span className="gg-text-body">Dinners</span>
              </div>
              <span className="text-2xl font-bold text-[var(--gg-primary)]">
                {totals.dinner}
              </span>
            </div>
            {totals.dinner > 0 && (
              <div className="text-sm text-gray-600 ml-9">
                {recipeCount.dinner} unique recipe{recipeCount.dinner !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between py-3 bg-opacity-10 rounded-lg px-4">
            <span className="font-semibold text-gray-900 text-2xl">Total Meals</span>
            <span className="text-3xl font-bold text-[var(--gg-primary)]">
              {totals.total}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="gg-bg-page min-h-screen">
      <div className="gg-container">
        <div className="gg-section">
          
          {/* Header */}
          <div ref={headerDescriptionRef} className="mb-8">
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
              {currentStep === 1 
                ? 'Select the meals you\'d like us to plan for you this week'
                : 'Choose how many unique recipes you want for each meal type'}
            </p>
          </div>

          {/* Step Indicator */}
          <div className="mb-6 flex flex-col items-center">
            <div className="flex items-center gap-1 sm:gap-2 max-w-full sm:max-w-[85%] lg:max-w-[75%] w-full px-2">
              <div className="flex flex-col items-center">
                <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full font-semibold text-sm sm:text-base ${
                  currentStep >= 1 
                    ? 'bg-[var(--gg-primary)] text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  1
                </div>
                <span className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 text-center">
                  <span className="hidden sm:inline">Select Meals</span>
                  <span className="sm:hidden">Meals</span>
                </span>
              </div>
              <div className={`flex-1 h-1 ${
                currentStep >= 2 ? 'bg-[var(--gg-primary)]' : 'bg-gray-200'
              }`} />
              <div className="flex flex-col items-center">
                <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full font-semibold text-sm sm:text-base ${
                  currentStep >= 2 
                    ? 'bg-[var(--gg-primary)] text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  2
                </div>
                <span className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 text-center">
                  <span className="hidden sm:inline">Recipe Variety</span>
                  <span className="sm:hidden">Variety</span>
                </span>
              </div>
              <div className={`flex-1 h-1 ${
                loading ? 'bg-[var(--gg-primary)]' : 'bg-gray-200'
              }`} />
              <div className="flex flex-col items-center">
                <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full font-semibold text-sm sm:text-base ${
                  loading 
                    ? 'bg-[var(--gg-primary)] text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  3
                </div>
                <span className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 text-center">
                  <span className="hidden sm:inline">Generate Plan</span>
                  <span className="sm:hidden">Generate</span>
                </span>
              </div>
            </div>
          </div>

          {/* Date Picker - Only show on Step 1 */}
          {currentStep === 1 && (
            <div className="mb-8">
              <div className="gg-card">
                <span className="block text-sm font-semibold text-gray-900 mb-3">
                  Select Start Date
                </span>
                <input
                  type="date"
                  id="start-date"
                  value={startDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[var(--gg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gg-primary)] focus:ring-opacity-20 text-gray-900 cursor-pointer"
                />
                {dateError && (
                  <p className="mt-2 text-sm text-red-600">{dateError}</p>
                )}
                {startDate && !dateError && (
                  <p className="mt-2 text-sm text-gray-600">
                    Meal plan will start on {new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                )}
              </div>
            </div>
          )}

          {!startDate && currentStep === 1 ? (
            <div className="gg-card text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-600 text-lg">Please select a start date above to begin selecting your meals</p>
            </div>
          ) : currentStep === 1 ? (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Step 1: Meal Selection Cards */}
              <div className="lg:col-span-2">
                <div className="gg-card">
                  <h2 className="gg-heading-section mb-6">Select Your Meals</h2>

                  {/* Quick Actions */}
                  <div className="mb-6 pb-6 border-b border-gray-200">
                    <p className="text-sm text-gray-600 mb-3">Quick actions:</p>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      <button
                        onClick={() => {
                          if (weekDays.length === 0) return
                          const allSelected = weekDays.every(
                            ({ dayName }) => selections[dayName]?.breakfast && selections[dayName]?.lunch && selections[dayName]?.dinner
                          )
                          setSelections(
                            weekDays.reduce((acc, { dayName }) => ({
                              ...acc,
                              [dayName]: { breakfast: !allSelected, lunch: !allSelected, dinner: !allSelected }
                            }), {})
                          )
                        }}
                        className="inline-flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg border-2 transition-all text-[var(--gg-primary)] border-[var(--gg-primary)] bg-transparent hover:bg-[var(--gg-primary)] hover:text-white active:scale-95 active:bg-[var(--gg-primary-hover)] active:text-white active:border-[var(--gg-primary-hover)]"
                      >
                        Toggle All
                      </button>
                      <button
                        onClick={() => {
                          if (weekDays.length === 0) return
                          const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
                          setSelections(
                            weekDays.reduce((acc, { dayName }) => ({
                              ...acc,
                              [dayName]: { 
                                breakfast: false, 
                                lunch: weekdayNames.includes(dayName), 
                                dinner: false 
                              }
                            }), {})
                          )
                        }}
                        className="inline-flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg border-2 transition-all text-[var(--gg-primary)] border-[var(--gg-primary)] bg-transparent hover:bg-[var(--gg-primary)] hover:text-white active:scale-95 active:bg-[var(--gg-primary-hover)] active:text-white active:border-[var(--gg-primary-hover)]"
                      >
                        Weekday Lunches
                      </button>
                      <button
                        onClick={() => {
                          if (weekDays.length === 0) return
                          setSelections(
                            weekDays.reduce((acc, { dayName }) => ({
                              ...acc,
                              [dayName]: { breakfast: false, lunch: false, dinner: true }
                            }), {})
                          )
                        }}
                        className="inline-flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg border-2 transition-all text-[var(--gg-primary)] border-[var(--gg-primary)] bg-transparent hover:bg-[var(--gg-primary)] hover:text-white active:scale-95 active:bg-[var(--gg-primary-hover)] active:text-white active:border-[var(--gg-primary-hover)]"
                      >
                        Dinners Only
                      </button>
                      <button
                        onClick={() => {
                          if (weekDays.length === 0) return
                          const allLunchDinnerSelected = weekDays.every(
                            ({ dayName }) => selections[dayName]?.lunch && selections[dayName]?.dinner
                          )
                          setSelections(
                            weekDays.reduce((acc, { dayName }) => ({
                              ...acc,
                              [dayName]: { 
                                breakfast: selections[dayName]?.breakfast ?? false,
                                lunch: !allLunchDinnerSelected,
                                dinner: !allLunchDinnerSelected
                              }
                            }), {})
                          )
                        }}
                        className="inline-flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg border-2 transition-all text-[var(--gg-primary)] border-[var(--gg-primary)] bg-transparent hover:bg-[var(--gg-primary)] hover:text-white active:scale-95 active:bg-[var(--gg-primary-hover)] active:text-white active:border-[var(--gg-primary-hover)]"
                      >
                        Lunch & Dinner
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {weekDays.map(({ dayName, dateDisplay }) => (
                      <div
                        key={dayName}
                        className="gg-card p-3 sm:p-6 border-2 border-gray-200 hover:border-[var(--gg-primary)] transition-colors"
                      >
                        <div className="mb-3 sm:mb-4">
                          <h3 className="text-base sm:text-xl font-bold text-gray-900 mb-0.5 sm:mb-1">{dayName}</h3>
                          <p className="text-xs sm:text-sm text-gray-600">{dateDisplay}</p>
                        </div>

                        <div className="space-y-2 sm:space-y-3">
                          {(['breakfast', 'lunch', 'dinner'] as MealType[]).map((mealType) => {
                            const isSelected = selections[dayName]?.[mealType] ?? false
                            const mealEmoji = mealType === 'breakfast' ? '🍳' : mealType === 'lunch' ? '🥗' : '🍽️'
                            
                            return (
                              <button
                                key={mealType}
                                onClick={() => toggleMeal(dayName, mealType)}
                                className={`w-full py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                                  isSelected
                                    ? 'bg-[var(--gg-primary)] text-white shadow-md hover:bg-[var(--gg-primary-hover)]'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                                  <span className="text-sm sm:text-lg">{mealEmoji}</span>
                                  <span className="capitalize">{mealType}</span>
                                  {isSelected && (
                                    <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sidebar - Summary */}
              <div className="space-y-6">
                <MealSummary />

                {/* Next Button */}
                <button
                  onClick={handleNext}
                  disabled={totals.total === 0 || !startDate}
                  className={`gg-btn-primary w-full flex items-center justify-center gap-2 ${
                    (totals.total === 0 || !startDate) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Next Step
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
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
          ) : (
            /* Step 2: Recipe Variety with Sliders */
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="gg-card mb-6">
                  <h2 className="gg-heading-section mb-4">How Much Variety Do You Want?</h2>
                  <p className="text-gray-600 mb-6">
                    Fewer unique recipes means easier batch cooking and grocery savings. 
                    Use the sliders to choose how many recipes you want, then optionally tap days to customize which meals share recipes.
                  </p>

                  {(['breakfast', 'lunch', 'dinner'] as MealType[]).map((mealType) => (
                    <MealTypeSliderCard
                      key={mealType}
                      mealType={mealType}
                      mealSlots={mealSlots}
                      recipeCount={recipeCount[mealType]}
                      recommendedCount={recommendedCounts[mealType]}
                      mealAssignments={mealAssignments}
                      selectedMealId={selectedMealId}
                      onSliderChange={(value) => handleSliderChange(mealType, value)}
                      onMealTap={handleMealTap}
                      onRecipeBoxTap={handleRecipeBoxTap}
                    />
                  ))}
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <MealSummary />

                {/* Navigation Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleBack}
                    disabled={loading}
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all text-[var(--gg-primary)] border-[var(--gg-primary)] bg-transparent hover:bg-[var(--gg-primary)] hover:text-white flex-1 gap-2 disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={loading || totals.total === 0 || !startDate}
                    className={`inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-md transition-all bg-[var(--gg-primary)] hover:bg-[var(--gg-primary-hover)] flex-1 gap-2 ${
                      (loading || totals.total === 0 || !startDate) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {loading ? (
                      <>
                        <svg 
                          className="animate-spin h-4 w-4" 
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
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Generate Meal Plan
                      </>
                    )}
                  </button>
                </div>

                {/* Batch Cooking Tip */}
                <div className="gg-card bg-green-50 border-green-200">
                  <div className="flex gap-3">
                    <span className="text-2xl">💡</span>
                    <div>
                      <p className="text-sm font-semibold text-green-900 mb-1">
                        Batch Cooking Tip
                      </p>
                      <p className="text-sm text-green-800">
                        Fewer recipes means you can cook once and enjoy leftovers throughout the week — saving time and money!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                You already have a meal plan that overlaps with the selected date range. Would you like to replace it with a new one?
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

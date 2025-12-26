'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
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

interface MealGroup {
  id: string
  mealType: MealType
  mealSlots: MealSlot[]
  recipeCount: number
}

interface MealPlanGenerateClientProps {
  surveyResponse: SurveyResponse
}

function isErrorResponse(response: GenerateMealPlanResponse): response is GenerateMealPlanError {
  return 'error' in response
}

function parseLunchPreference(preference?: string, totalSlots?: number) {
  if (!preference || !totalSlots || totalSlots === 0) return undefined

  const numberMatch = preference.match(/\d+/)
  if (!numberMatch) return undefined

  const parsed = parseInt(numberMatch[0], 10)
  if (Number.isNaN(parsed) || parsed <= 0) return undefined

  return Math.min(parsed, totalSlots)
}

function deriveBaseDistinct(totalSlots: number, leftoverPreference?: string) {
  if (totalSlots === 0) return 0

  switch (leftoverPreference) {
    case 'Prefer unique meals every time':
      return totalSlots
    case 'Happy to eat leftovers once more':
      return Math.max(1, Math.ceil(totalSlots / 2))
    case 'Comfortable repeating meals multiple times':
      return Math.max(1, Math.ceil(totalSlots / 3))
    default:
      return Math.max(1, Math.ceil(totalSlots / 2))
  }
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

// Draggable Meal Chip Component
function MealChip({ mealSlot, isDragging }: { mealSlot: MealSlot; isDragging?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({
    id: mealSlot.id,
    data: {
      mealSlot,
    },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  const mealTypeLabel = mealSlot.mealType.charAt(0).toUpperCase() + mealSlot.mealType.slice(1)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`px-4 py-3 bg-white border-2 border-gray-200 rounded-lg cursor-grab active:cursor-grabbing hover:border-[var(--gg-primary)] hover:shadow-md transition-all ${
        isDragging ? 'shadow-lg scale-105' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-900 capitalize">{mealTypeLabel} #{mealSlot.mealNumber}</span>
      </div>
    </div>
  )
}

// Recipe Box Component
function RecipeBox({
  group,
  mealSlots,
  onDeleteGroup,
  onRemoveMeal,
  isOver,
  isDragging,
}: {
  group: MealGroup
  mealSlots: MealSlot[]
  onDeleteGroup: (groupId: string) => void
  onRemoveMeal: (groupId: string, mealSlotId: string) => void
  isOver: boolean
  isDragging: boolean
}) {
  const { setNodeRef: setDroppableRef, isOver: isOverDroppable } = useDroppable({
    id: `recipe-${group.mealType}-${group.id}`,
    data: {
      mealType: group.mealType,
      groupId: group.id,
    },
  })

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
  } = useDraggable({
    id: `recipe-box-${group.id}`,
    data: {
      type: 'recipe-box',
      group,
    },
  })

  // Combine refs for both draggable and droppable
  const setNodeRef = (node: HTMLElement | null) => {
    setDroppableRef(node)
    setDraggableRef(node)
  }

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  const groupMealSlots = mealSlots.filter(slot => 
    group.mealSlots.some(ms => ms.id === slot.id)
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`border-2 rounded-xl p-4 transition-all cursor-grab active:cursor-grabbing bg-gray-50 ${
        isDragging
          ? 'border-green-500'
          : (isOver || isOverDroppable)
          ? 'border-[var(--gg-primary)] bg-[var(--gg-primary)] bg-opacity-5'
          : 'border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-900">{group.id}</h4>
        <button
          onClick={() => onDeleteGroup(group.id)}
          className="text-gray-400 hover:text-red-600 transition-colors"
          aria-label="Delete recipe"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="min-h-[60px]">
        {groupMealSlots.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {groupMealSlots.map(slot => {
              const mealTypeLabel = slot.mealType.charAt(0).toUpperCase() + slot.mealType.slice(1)
              
              return (
                <div
                  key={slot.id}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm flex items-center gap-2"
                >
                  <span className="font-medium text-gray-900 capitalize">{mealTypeLabel} #{slot.mealNumber}</span>
                  <button
                    onClick={() => onRemoveMeal(group.id, slot.id)}
                    className="ml-1 text-gray-400 hover:text-red-600 transition-colors"
                    aria-label="Remove meal"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Drag meals here</p>
        )}
      </div>
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
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draggedOverGroupId, setDraggedOverGroupId] = useState<string | null>(null)

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

  const leftoverPreference = surveyResponse?.['12'] as string ?? surveyResponse?.[12] as string
  const lunchPreference = surveyResponse?.['13'] as string ?? surveyResponse?.[13] as string

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

  // Meal groups state
  const [mealGroups, setMealGroups] = useState<MealGroup[]>([])

  // Initialize distinct counts based on preferences
  const [distinctCounts, setDistinctCounts] = useState<DistinctCounts>(() => {
    const baseCounts: DistinctCounts = {
      breakfast: deriveBaseDistinct(totals.breakfast, leftoverPreference),
      lunch: deriveBaseDistinct(totals.lunch, leftoverPreference),
      dinner: deriveBaseDistinct(totals.dinner, leftoverPreference)
    }

    const parsedLunch = parseLunchPreference(lunchPreference, totals.lunch)
    if (parsedLunch !== undefined) {
      baseCounts.lunch = Math.max(1, parsedLunch)
    }

    return clampDistinctCounts(baseCounts, totals)
  })

  // Update distinct counts when totals change
  useEffect(() => {
    setDistinctCounts(prev =>
      clampDistinctCounts(prev, {
        breakfast: totals.breakfast,
        lunch: totals.lunch,
        dinner: totals.dinner
      })
    )
  }, [totals.breakfast, totals.lunch, totals.dinner])

  // Reset groups when selections change
  useEffect(() => {
    if (currentStep === 1) {
      setMealGroups([])
    }
  }, [selectedSlots, currentStep])

  // Helper function to get next recipe number for a meal type
  const getNextRecipeNumber = (mealType: MealType): number => {
    const groupsForType = mealGroups.filter(g => g.mealType === mealType)
    if (groupsForType.length === 0) return 1
    
    // Extract numbers from existing recipe IDs and find the max
    const numbers = groupsForType
      .map(g => {
        const match = g.id.match(/Recipe (\d+)/)
        return match ? parseInt(match[1], 10) : 0
      })
      .filter(n => n > 0)
    
    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1
  }

  // Helper function to renumber recipes for a meal type
  const renumberRecipesForMealType = (mealType: MealType, groups: MealGroup[]): MealGroup[] => {
    const groupsForType = groups.filter(g => g.mealType === mealType)
    const otherGroups = groups.filter(g => g.mealType !== mealType)
    
    // Sort by current number to maintain order
    const sorted = [...groupsForType].sort((a, b) => {
      const numA = parseInt(a.id.match(/Recipe (\d+)/)?.[1] || '0', 10)
      const numB = parseInt(b.id.match(/Recipe (\d+)/)?.[1] || '0', 10)
      return numA - numB
    })
    
    // Renumber sequentially
    const renumbered = sorted.map((g, index) => ({
      ...g,
      id: `Recipe ${index + 1}`
    }))
    
    return [...otherGroups, ...renumbered]
  }

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

  // Drag and drop handlers
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (over && typeof over.id === 'string' && over.id.startsWith('recipe-')) {
      // Get the meal type of the dragged meal
      const mealSlotId = active.id as string
      const mealSlot = active.data?.current?.mealSlot || mealSlots.find(ms => ms.id === mealSlotId)
      
      if (mealSlot) {
        // Get meal type from droppable data or parse from ID
        const droppableData = over.data?.current
        const droppableMealType = droppableData?.mealType as MealType | undefined
        
        if (droppableMealType && droppableMealType === mealSlot.mealType) {
          const groupId = droppableData?.groupId as string | undefined
          if (groupId) {
            setDraggedOverGroupId(groupId)
          } else {
            setDraggedOverGroupId(null)
          }
        } else {
          setDraggedOverGroupId(null)
        }
      } else {
        setDraggedOverGroupId(null)
      }
    } else {
      setDraggedOverGroupId(null)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setDraggedOverGroupId(null)

    if (!over) return

    const mealSlotId = active.id as string
    const mealSlot = active.data?.current?.mealSlot || mealSlots.find(ms => ms.id === mealSlotId)
    if (!mealSlot) return

    // Find if meal is already in a group
    const existingGroupIndex = mealGroups.findIndex(g =>
      g.mealSlots.some(ms => ms.id === mealSlotId)
    )

    // Remove from existing group if present
    if (existingGroupIndex !== -1) {
      const existingGroup = mealGroups[existingGroupIndex]
      const updatedMealSlots = existingGroup.mealSlots.filter(ms => ms.id !== mealSlotId)
      
      if (updatedMealSlots.length === 0) {
        // Remove empty group
        setMealGroups(prev => prev.filter((_, i) => i !== existingGroupIndex))
      } else {
        // Update group
        setMealGroups(prev => prev.map((g, i) =>
          i === existingGroupIndex
            ? { ...g, mealSlots: updatedMealSlots, recipeCount: Math.min(g.recipeCount, updatedMealSlots.length) }
            : g
        ))
      }
    }

    // Add to new recipe group
    if (typeof over.id === 'string' && over.id.startsWith('recipe-')) {
      // Get meal type and group ID from droppable data
      const droppableData = over.data?.current
      const droppableMealType = droppableData?.mealType as MealType | undefined
      const targetGroupId = droppableData?.groupId as string | undefined
      
      // Only proceed if meal types match
      if (!droppableMealType || droppableMealType !== mealSlot.mealType || !targetGroupId) return
      
      const targetGroupIndex = mealGroups.findIndex(g => g.id === targetGroupId && g.mealType === droppableMealType)

      if (targetGroupIndex !== -1) {
        const targetGroup = mealGroups[targetGroupIndex]
        // Only add if meal is not already in this group
        if (!targetGroup.mealSlots.some(ms => ms.id === mealSlotId)) {
          // Add to existing recipe group
          setMealGroups(prev => prev.map((g, i) =>
            i === targetGroupIndex
              ? {
                  ...g,
                  mealSlots: [...g.mealSlots, mealSlot],
                  recipeCount: Math.min(g.recipeCount + 1, g.mealSlots.length + 1)
                }
              : g
          ))
        }
      } else {
        // Create new recipe group
        const nextNumber = getNextRecipeNumber(mealSlot.mealType)
        const newGroup: MealGroup = {
          id: `Recipe ${nextNumber}`,
          mealType: mealSlot.mealType,
          mealSlots: [mealSlot],
          recipeCount: 1
        }
        setMealGroups(prev => [...prev, newGroup])
      }
    }
  }

  const updateDistinctCount = (mealType: MealType, value: number) => {
    setDistinctCounts(prev => {
      const updated = { ...prev, [mealType]: value }
      return clampDistinctCounts(updated, {
        breakfast: totals.breakfast,
        lunch: totals.lunch,
        dinner: totals.dinner
      })
    })
  }

  const handleUpdateGroupRecipeCount = (groupId: string, count: number) => {
    setMealGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, recipeCount: count } : g
    ))
  }

  const handleDeleteGroup = (groupId: string) => {
    setMealGroups(prev => {
      const deletedGroup = prev.find(g => g.id === groupId)
      if (!deletedGroup) return prev
      
      // Remove the group
      const filtered = prev.filter(g => g.id !== groupId)
      
      // Renumber recipes for the same meal type
      return renumberRecipesForMealType(deletedGroup.mealType, filtered)
    })
  }

  const handleRemoveMealFromGroup = (groupId: string, mealSlotId: string) => {
    setMealGroups(prev => {
      const groupToUpdate = prev.find(g => g.id === groupId)
      if (!groupToUpdate) return prev
      
      const updated = prev.map(g => {
        if (g.id === groupId) {
          const updatedMealSlots = g.mealSlots.filter(ms => ms.id !== mealSlotId)
          if (updatedMealSlots.length === 0) {
            // Return null to filter out empty groups
            return null
          }
          return { ...g, mealSlots: updatedMealSlots, recipeCount: Math.min(g.recipeCount, updatedMealSlots.length) }
        }
        return g
      }).filter((g): g is MealGroup => g !== null)
      
      // If a group was deleted, renumber recipes for that meal type
      if (updated.length < prev.length) {
        return renumberRecipesForMealType(groupToUpdate.mealType, updated)
      }
      
      return updated
    })
  }

  // Get ungrouped meals by meal type
  const getUngroupedMeals = (mealType: MealType): MealSlot[] => {
    const groupedMealIds = new Set(
      mealGroups
        .filter(g => g.mealType === mealType)
        .flatMap(g => g.mealSlots.map(ms => ms.id))
    )
    return mealSlots.filter(ms => ms.mealType === mealType && !groupedMealIds.has(ms.id))
  }

  // Get groups by meal type
  const getGroupsByMealType = (mealType: MealType): MealGroup[] => {
    return mealGroups.filter(g => g.mealType === mealType)
  }

  // Calculate final distinct counts for generation
  const getFinalDistinctCounts = (): DistinctCounts => {
    // Calculate distinct counts based on recipe groups and ungrouped meals
    const groupedMealIds = new Set(
      mealGroups.flatMap(g => g.mealSlots.map(ms => ms.id))
    )
    
    const counts: DistinctCounts = {
      breakfast: 0,
      lunch: 0,
      dinner: 0
    }
    
    // For each meal type, count: number of recipe groups + number of ungrouped meals
    ;(['breakfast', 'lunch', 'dinner'] as MealType[]).forEach(mealType => {
      // Count recipe groups for this meal type
      const groupsForType = mealGroups.filter(g => g.mealType === mealType)
      const groupCount = groupsForType.length
      
      // Count ungrouped meals for this meal type (each ungrouped meal is its own recipe)
      const ungroupedForType = mealSlots.filter(
        ms => ms.mealType === mealType && !groupedMealIds.has(ms.id)
      )
      const ungroupedCount = ungroupedForType.length
      
      // Total unique recipes = groups + ungrouped meals
      counts[mealType] = groupCount + ungroupedCount
    })
    
    return counts
  }

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
      const finalDistinctCounts = getFinalDistinctCounts()

      const result = await generateMealPlanFromPreferences(
        weekOf,
        {
          breakfast: totals.breakfast,
          lunch: totals.lunch,
          dinner: totals.dinner
        },
        finalDistinctCounts,
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
    } catch (err) {
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
      const finalDistinctCounts = getFinalDistinctCounts()

      const result = await replaceExistingMealPlan(
        conflictData.existingPlanId,
        conflictData.weekOf,
        {
          breakfast: totals.breakfast,
          lunch: totals.lunch,
          dinner: totals.dinner
        },
        finalDistinctCounts,
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
    } catch (err) {
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
    const recipeCounts = useMemo(() => {
      // Calculate ungrouped meals for each type
      const groupedMealIds = new Set(
        mealGroups.flatMap(g => g.mealSlots.map(ms => ms.id))
      )
      const ungroupedMealsByType = {
        breakfast: mealSlots.filter(ms => ms.mealType === 'breakfast' && !groupedMealIds.has(ms.id)).length,
        lunch: mealSlots.filter(ms => ms.mealType === 'lunch' && !groupedMealIds.has(ms.id)).length,
        dinner: mealSlots.filter(ms => ms.mealType === 'dinner' && !groupedMealIds.has(ms.id)).length,
      }
      
      // Total unique recipes = recipe groups + ungrouped meals (each ungrouped meal is its own recipe)
      return {
        breakfast: mealGroups.filter(g => g.mealType === 'breakfast').length + ungroupedMealsByType.breakfast,
        lunch: mealGroups.filter(g => g.mealType === 'lunch').length + ungroupedMealsByType.lunch,
        dinner: mealGroups.filter(g => g.mealType === 'dinner').length + ungroupedMealsByType.dinner,
      }
    }, [mealGroups, mealSlots])

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
            <div className="text-sm text-gray-600 ml-9">
              {recipeCounts.breakfast} unique recipe{recipeCounts.breakfast !== 1 ? 's' : ''}
            </div>
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
            <div className="text-sm text-gray-600 ml-9">
              {recipeCounts.lunch} unique recipe{recipeCounts.lunch !== 1 ? 's' : ''}
            </div>
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
            <div className="text-sm text-gray-600 ml-9">
              {recipeCounts.dinner} unique recipe{recipeCounts.dinner !== 1 ? 's' : ''}
            </div>
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
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
                {currentStep === 1 
                  ? 'Select the meals you\'d like us to plan for you this week'
                  : 'Group meals and choose how many unique recipes you want'}
              </p>
            </div>

            {/* Step Indicator */}
            <div className="mb-6 flex flex-col items-center">
              <div className="flex items-center gap-2 max-w-[75%] w-full">
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                    currentStep >= 1 
                      ? 'bg-[var(--gg-primary)] text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    1
                  </div>
                  <span className="mt-2 text-sm text-gray-600">Select Meals</span>
                </div>
                <div className={`flex-1 h-1 ${
                  currentStep >= 2 ? 'bg-[var(--gg-primary)]' : 'bg-gray-200'
                }`} />
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                    currentStep >= 2 
                      ? 'bg-[var(--gg-primary)] text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    2
                  </div>
                  <span className="mt-2 text-sm text-gray-600">Choose Recipes</span>
                </div>
                <div className={`flex-1 h-1 ${
                  loading ? 'bg-[var(--gg-primary)]' : 'bg-gray-200'
                }`} />
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                    loading 
                      ? 'bg-[var(--gg-primary)] text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    3
                  </div>
                  <span className="mt-2 text-sm text-gray-600">Generate Meal Plan</span>
                </div>
              </div>
            </div>

            {/* Date Picker - Only show on Step 1 */}
            {currentStep === 1 && (
              <div className="mb-8">
                <div className="gg-card">
                  <label htmlFor="start-date" className="block text-sm font-semibold text-gray-900 mb-3">
                    Select Start Date
                  </label>
                  <input
                    type="date"
                    id="start-date"
                    value={startDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[var(--gg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gg-primary)] focus:ring-opacity-20 text-gray-900"
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
                      <div className="flex flex-wrap gap-2">
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
                          className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg border-2 transition-all text-[var(--gg-primary)] border-[var(--gg-primary)] bg-transparent hover:bg-[var(--gg-primary)] hover:text-white"
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
                          className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg border-2 transition-all text-[var(--gg-primary)] border-[var(--gg-primary)] bg-transparent hover:bg-[var(--gg-primary)] hover:text-white"
                        >
                          Weekday Lunches Only
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
                          className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg border-2 transition-all text-[var(--gg-primary)] border-[var(--gg-primary)] bg-transparent hover:bg-[var(--gg-primary)] hover:text-white"
                        >
                          Dinners Only
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {weekDays.map(({ dayName, dateDisplay }) => (
                        <div
                          key={dayName}
                          className="gg-card p-6 border-2 border-gray-200 hover:border-[var(--gg-primary)] transition-colors"
                        >
                          <div className="mb-4">
                            <h3 className="text-xl font-bold text-gray-900 mb-1">{dayName}</h3>
                            <p className="text-sm text-gray-600">{dateDisplay}</p>
                          </div>

                          <div className="space-y-3">
                            {(['breakfast', 'lunch', 'dinner'] as MealType[]).map((mealType) => {
                              const isSelected = selections[dayName]?.[mealType] ?? false
                              const mealEmoji = mealType === 'breakfast' ? '🍳' : mealType === 'lunch' ? '🥗' : '🍽️'
                              
                              return (
                                <button
                                  key={mealType}
                                  onClick={() => toggleMeal(dayName, mealType)}
                                  className={`w-full py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                                    isSelected
                                      ? 'bg-[var(--gg-primary)] text-white shadow-md hover:bg-[var(--gg-primary-hover)]'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent hover:border-gray-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className="text-lg">{mealEmoji}</span>
                                    <span className="capitalize">{mealType}</span>
                                    {isSelected && (
                                      <svg className="h-3.5 w-3.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              /* Step 2: Recipe Selection with Grouping */
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <div className="gg-card mb-6">
                    <h2 className="gg-heading-section mb-4">Choose Recipe Variety</h2>
                    <p className="text-gray-600 mb-6">
                      Group meals together to share the same recipes. Drag meals into recipe boxes to organize them. Each meal will get its own recipe if not grouped.
                    </p>

                    {(['breakfast', 'lunch', 'dinner'] as MealType[]).map((mealType) => {
                      const ungroupedMeals = getUngroupedMeals(mealType)
                      const groups = getGroupsByMealType(mealType)
                      const mealEmoji = mealType === 'breakfast' ? '🍳' : mealType === 'lunch' ? '🥗' : '🍽️'

                      if (totals[mealType] === 0) return null

                      return (
                        <div key={mealType} className="mb-8 last:mb-0">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-3xl">{mealEmoji}</span>
                            <h3 className="text-xl font-bold text-gray-900 capitalize">{mealType}</h3>
                            <span className="text-sm text-gray-500">
                              ({totals[mealType]} meal{totals[mealType] === 1 ? '' : 's'})
                            </span>
                          </div>

                          {/* Available Meals */}
                          {ungroupedMeals.length > 0 && (
                            <div className="mb-4">
                              <p className="text-sm font-semibold text-gray-700 mb-2">Available Meals:</p>
                              <div className="flex flex-wrap gap-2">
                                {ungroupedMeals.map(mealSlot => (
                                  <MealChip
                                    key={mealSlot.id}
                                    mealSlot={mealSlot}
                                    isDragging={activeId === mealSlot.id}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Recipe Groups */}
                          {groups.length > 0 && (
                            <div className="mb-4">
                              <p className="text-sm font-semibold text-gray-700 mb-3">Recipes:</p>
                              <div className="space-y-4">
                                {groups.map(group => (
                                  <RecipeBox
                                    key={group.id}
                                    group={group}
                                    mealSlots={mealSlots}
                                    onDeleteGroup={handleDeleteGroup}
                                    onRemoveMeal={handleRemoveMealFromGroup}
                                    isOver={draggedOverGroupId === group.id}
                                    isDragging={activeId === `recipe-box-${group.id}`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Create Recipe Button */}
                          {totals[mealType] > 1 && groups.length < totals[mealType] && ungroupedMeals.length > 0 && (
                            <button
                              onClick={() => {
                                const nextNumber = getNextRecipeNumber(mealType)
                                const newGroup: MealGroup = {
                                  id: `Recipe ${nextNumber}`,
                                  mealType,
                                  mealSlots: [],
                                  recipeCount: 1
                                }
                                setMealGroups(prev => [...prev, newGroup])
                              }}
                              className="mt-4 px-4 py-2 text-sm font-medium text-[var(--gg-primary)] border-2 border-[var(--gg-primary)] rounded-lg hover:bg-[var(--gg-primary)] hover:text-white transition-colors"
                            >
                              + Create New Recipe
                            </button>
                          )}
                        </div>
                      )
                    })}
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
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId ? (
          (() => {
            const mealSlot = mealSlots.find(ms => ms.id === activeId)
            if (!mealSlot) return null
            
            const mealTypeLabel = mealSlot.mealType.charAt(0).toUpperCase() + mealSlot.mealType.slice(1)
            
            return (
              <div className="px-4 py-3 bg-white border-2 border-[var(--gg-primary)] rounded-lg shadow-lg opacity-90">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 capitalize">{mealTypeLabel} #{mealSlot.mealNumber}</span>
                </div>
              </div>
            )
          })()
        ) : null}
      </DragOverlay>

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
    </DndContext>
  )
}

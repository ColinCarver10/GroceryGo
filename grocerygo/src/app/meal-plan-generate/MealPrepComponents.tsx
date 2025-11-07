'use client'

import { useState } from 'react'

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

export interface MealSelections {
  [key: string]: {
    breakfast: boolean
    lunch: boolean
    dinner: boolean
  }
}

export interface MealPrepBatch {
  days: string[]
  mealType: MealType
}

export interface MealPrepConfig {
  breakfast: MealPrepBatch[]
  lunch: MealPrepBatch[]
  dinner: MealPrepBatch[]
}

// MealPrepInterface Component
interface MealPrepInterfaceProps {
  selections: MealSelections
  mealPrepConfig: MealPrepConfig
  setMealPrepConfig: (config: MealPrepConfig) => void
}

export function MealPrepInterface({ 
  selections, 
  mealPrepConfig, 
  setMealPrepConfig 
}: MealPrepInterfaceProps) {
  const [activeMealType, setActiveMealType] = useState<MealType>('dinner')
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set())

  // Get days that have this meal type selected
  const availableDays = daysOfWeek
    .map(d => d.full)
    .filter(day => selections[day][activeMealType])

  // Get days already in batches
  const daysInBatches = new Set(
    mealPrepConfig[activeMealType].flatMap(batch => batch.days)
  )

  const toggleDaySelection = (day: string) => {
    const newSelected = new Set(selectedDays)
    if (newSelected.has(day)) {
      newSelected.delete(day)
    } else {
      newSelected.add(day)
    }
    setSelectedDays(newSelected)
  }

  const createBatch = () => {
    if (selectedDays.size < 2) {
      alert('Select at least 2 days for a meal prep batch')
      return
    }

    const newBatch: MealPrepBatch = {
      days: Array.from(selectedDays),
      mealType: activeMealType
    }

    setMealPrepConfig({
      ...mealPrepConfig,
      [activeMealType]: [...mealPrepConfig[activeMealType], newBatch]
    })

    setSelectedDays(new Set())
  }

  const removeBatch = (batchIndex: number) => {
    const newBatches = mealPrepConfig[activeMealType].filter((_, i) => i !== batchIndex)
    setMealPrepConfig({
      ...mealPrepConfig,
      [activeMealType]: newBatches
    })
  }

  return (
    <div className="gg-card">
      <h2 className="gg-heading-section mb-6">Configure Meal Prep Batches</h2>

      {/* Meal Type Selector */}
      <div className="flex gap-2 mb-6 p-2 bg-gray-100 rounded-lg">
        {(['breakfast', 'lunch', 'dinner'] as MealType[]).map(mealType => {
          const count = Object.values(selections).filter(day => day[mealType]).length
          if (count === 0) return null
          
          return (
            <button
              key={mealType}
              onClick={() => setActiveMealType(mealType)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all capitalize ${
                activeMealType === mealType
                  ? 'bg-white text-[var(--gg-primary)] shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {mealType === 'breakfast' && '🍳'} 
              {mealType === 'lunch' && '🥗'} 
              {mealType === 'dinner' && '🍽️'} 
              {' '}{mealType}
              <span className="ml-2 text-xs opacity-70">({count} days)</span>
            </button>
          )
        })}
      </div>

      {availableDays.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No {activeMealType}s selected.</p>
          <p className="text-sm mt-2">Go back to regular mode to select days first.</p>
        </div>
      ) : (
        <>
          {/* Existing Batches */}
          {mealPrepConfig[activeMealType].length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Current Batches:</h3>
              <div className="space-y-2">
                {mealPrepConfig[activeMealType].map((batch, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-lg"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">
                        Batch {String.fromCharCode(65 + index)} 
                        <span className="ml-2 text-sm font-normal text-gray-600">
                          ({batch.days.length} days)
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {batch.days.join(', ')}
                      </div>
                    </div>
                    <button
                      onClick={() => removeBatch(index)}
                      className="text-red-600 hover:text-red-800 p-2"
                      title="Remove batch"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day Selection for New Batch */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Create New Batch:
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Select days that will share the same recipe
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {availableDays.map(day => {
                const inExistingBatch = daysInBatches.has(day)
                const isSelected = selectedDays.has(day)
                
                return (
                  <button
                    key={day}
                    onClick={() => !inExistingBatch && toggleDaySelection(day)}
                    disabled={inExistingBatch}
                    className={`p-4 rounded-lg border-2 font-medium transition-all ${
                      inExistingBatch
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isSelected
                        ? 'border-[var(--gg-primary)] bg-[var(--gg-primary)] text-white'
                        : 'border-gray-300 hover:border-[var(--gg-primary)] text-gray-700'
                    }`}
                  >
                    {day}
                    {inExistingBatch && (
                      <span className="block text-xs mt-1">Already in batch</span>
                    )}
                  </button>
                )
              })}
            </div>

            <button
              onClick={createBatch}
              disabled={selectedDays.size < 2}
              className="gg-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Batch with {selectedDays.size} Days
            </button>
          </div>
        </>
      )}

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">💡 Tip:</span> Each batch uses ONE recipe for all selected days. 
          The portion size will be automatically scaled.
        </p>
      </div>
    </div>
  )
}

// MealPrepSummary Component
interface MealPrepSummaryProps {
  mealPrepConfig: MealPrepConfig
}

export function MealPrepSummary({ mealPrepConfig }: MealPrepSummaryProps) {
  const getTotalRecipes = () => {
    return Object.values(mealPrepConfig).reduce((sum: number, batches: MealPrepBatch[]) => sum + batches.length, 0)
  }

  const getTotalMealDays = () => {
    return Object.values(mealPrepConfig).reduce(
      (sum: number, batches: MealPrepBatch[]) => sum + batches.reduce((batchSum: number, batch: MealPrepBatch) => batchSum + batch.days.length, 0),
      0
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📦</span>
          <span className="gg-text-body">Unique Recipes</span>
        </div>
        <span className="text-2xl font-bold text-[var(--gg-primary)]">
          {getTotalRecipes()}
        </span>
      </div>

      <div className="flex items-center justify-between py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🗓️</span>
          <span className="gg-text-body">Total Meal Days</span>
        </div>
        <span className="text-2xl font-bold text-[var(--gg-primary)]">
          {getTotalMealDays()}
        </span>
      </div>

      {/* Breakdown by meal type */}
      {(['breakfast', 'lunch', 'dinner'] as const).map(mealType => {
        const batches = mealPrepConfig[mealType]
        if (batches.length === 0) return null

        const emoji = mealType === 'breakfast' ? '🍳' : mealType === 'lunch' ? '🥗' : '🍽️'
        const totalDays = batches.reduce((sum, batch) => sum + batch.days.length, 0)

        return (
          <div key={mealType} className="py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{emoji}</span>
                <span className="gg-text-body capitalize">{mealType}</span>
              </div>
              <span className="text-sm font-semibold text-gray-600">
                {batches.length} recipes → {totalDays} days
              </span>
            </div>
            
            {/* Show batches */}
            <div className="ml-8 space-y-1">
              {batches.map((batch, index) => (
                <div key={index} className="text-xs text-gray-600">
                  Batch {String.fromCharCode(65 + index)}: {batch.days.length} days
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div className="flex items-center justify-between py-3 bg-opacity-10 rounded-lg px-4">
        <span className="font-semibold text-gray-900">Time Saved</span>
        <span className="text-xl font-bold text-green-600">
          ~{Math.max(0, getTotalMealDays() - getTotalRecipes())} meals
        </span>
      </div>
    </div>
  )
}


'use client'

import { useState } from 'react'

interface AdjustPlanPanelProps {
  isOpen: boolean
  onClose: () => void
  onApplyAdjustments?: (adjustments: PlanAdjustments) => void
  appliedAdjustments?: string[]
}

export interface PlanAdjustments {
  reduceTime?: boolean
  lowerBudget?: boolean
  minimizeIngredients?: boolean
}

export default function AdjustPlanPanel({
  isOpen,
  onClose,
  onApplyAdjustments,
  appliedAdjustments = []
}: AdjustPlanPanelProps) {
  const [adjustments, setAdjustments] = useState<PlanAdjustments>({
    reduceTime: false,
    lowerBudget: false,
    minimizeIngredients: false
  })

  const [isApplying, setIsApplying] = useState(false)

  const toggleAdjustment = (key: keyof PlanAdjustments) => {
    setAdjustments(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleApply = () => {
    if (onApplyAdjustments) {
      setIsApplying(true)
      onApplyAdjustments(adjustments)
    }
  }

  const hasAnyAdjustments = Object.values(adjustments).some(v => v)

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black opacity-30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Adjust This Plan</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-gray-600 mb-6">
            Select adjustments to regenerate your meal plan with new constraints. The plan will keep your original preferences while applying these modifications.
          </p>

          {/* Optimization Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Optimizations</h3>
            <div className="space-y-2">
              <AdjustmentCheckbox
                checked={adjustments.reduceTime || false}
                onChange={() => toggleAdjustment('reduceTime')}
                label="Reduce Prep Time"
                description="Favor quick & simple recipes"
                icon="⏱️"
                disabled={appliedAdjustments.includes('reduceTime')}
                alreadyApplied={appliedAdjustments.includes('reduceTime')}
              />
              <AdjustmentCheckbox
                checked={adjustments.lowerBudget || false}
                onChange={() => toggleAdjustment('lowerBudget')}
                label="Lower Budget"
                description="Use cheaper ingredients"
                icon="💰"
                disabled={appliedAdjustments.includes('lowerBudget')}
                alreadyApplied={appliedAdjustments.includes('lowerBudget')}
              />
              <AdjustmentCheckbox
                checked={adjustments.minimizeIngredients || false}
                onChange={() => toggleAdjustment('minimizeIngredients')}
                label="Minimize Ingredients"
                description="Maximize ingredient reuse"
                icon="📦"
                disabled={appliedAdjustments.includes('minimizeIngredients')}
                alreadyApplied={appliedAdjustments.includes('minimizeIngredients')}
              />
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <svg className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-1">Note</p>
                <p className="text-sm text-blue-800">
                  Applying adjustments will regenerate your entire meal plan. Any saved favorites will be kept if possible.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!hasAnyAdjustments || isApplying}
              className="flex-1 px-4 py-3 rounded-lg bg-[var(--gg-primary)] text-white font-semibold hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isApplying ? (
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
                  Applying...
                </>
              ) : (
                'Apply Adjustments'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

interface AdjustmentCheckboxProps {
  checked: boolean
  onChange: () => void
  label: string
  description: string
  icon: string
  disabled?: boolean
  alreadyApplied?: boolean
}

function AdjustmentCheckbox({
  checked,
  onChange,
  label,
  description,
  icon,
  disabled = false,
  alreadyApplied = false
}: AdjustmentCheckboxProps) {
  return (
    <label className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-colors ${
      disabled 
        ? 'border-green-200 bg-green-50 cursor-not-allowed opacity-75' 
        : 'border-gray-200 hover:border-[var(--gg-primary)] cursor-pointer bg-white'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-1 h-5 w-5 rounded border-gray-300 text-[var(--gg-primary)] focus:ring-[var(--gg-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className={`font-semibold ${disabled ? 'text-green-800' : 'text-gray-900'}`}>
            {label}
          </span>
          {alreadyApplied && (
            <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-green-700 bg-green-100 rounded-full">
              ✓ Applied
            </span>
          )}
        </div>
        <p className={`text-sm mt-0.5 ${disabled ? 'text-green-700' : 'text-gray-600'}`}>
          {alreadyApplied ? 'This optimization has already been applied to this meal plan' : description}
        </p>
      </div>
    </label>
  )
}


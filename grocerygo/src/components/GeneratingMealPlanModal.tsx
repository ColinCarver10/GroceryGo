'use client'

import { useEffect, useRef } from 'react'
import { checkMealPlanRecipesExist } from '@/app/dashboard/actions'

interface GeneratingMealPlanModalProps {
  mealPlanId: string
  isOpen: boolean
  onClose: () => void
  onGenerationComplete: () => void
}

export default function GeneratingMealPlanModal({
  mealPlanId,
  isOpen,
  onClose,
  onGenerationComplete
}: GeneratingMealPlanModalProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const onGenerationCompleteRef = useRef(onGenerationComplete)
  const onCloseRef = useRef(onClose)

  // Keep refs updated
  useEffect(() => {
    onGenerationCompleteRef.current = onGenerationComplete
    onCloseRef.current = onClose
  }, [onGenerationComplete, onClose])

  useEffect(() => {
    if (isOpen) {
      // Poll every 3 seconds to check if recipes exist
      intervalRef.current = setInterval(async () => {
        const recipesExist = await checkMealPlanRecipesExist(mealPlanId)
        
        if (recipesExist) {
          // Generation is complete
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          onGenerationCompleteRef.current()
          onCloseRef.current()
        }
      }, 3000)
      
      // Cleanup on unmount or when modal closes
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    } else {
      // Stop polling when modal closes
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isOpen, mealPlanId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-200">
      <div className="gg-card max-w-md w-full mx-4">
        <div className="text-center">
          {/* Spinner */}
          <div className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-4 border-gray-200 border-t-[var(--gg-primary)]"></div>
          
          {/* Title */}
          <h2 className="gg-heading-section mb-3">
            Meal Plan Still Generating
          </h2>
          
          {/* Description */}
          <p className="gg-text-body mb-6 text-gray-600">
            Your meal plan is still being optimized, please check back in a few minutes.
          </p>
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="gg-btn-outline w-full"
          >
            Close
          </button>
          
          {/* Info Text */}
          <p className="mt-4 text-xs text-gray-500">
            This window will automatically close when generation is complete
          </p>
        </div>
      </div>
    </div>
  )
}


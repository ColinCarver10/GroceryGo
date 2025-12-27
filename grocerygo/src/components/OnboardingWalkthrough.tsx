'use client'

import { useEffect } from 'react'
import type { WalkthroughStep } from '@/app/dashboard/walkthroughContent'

interface OnboardingWalkthroughProps {
  isOpen: boolean
  currentStep: number
  totalSteps: number
  step: WalkthroughStep
  onNext: () => void
  onPrevious: () => void
  onComplete: () => void
}

export default function OnboardingWalkthrough({
  isOpen,
  currentStep,
  totalSteps,
  step,
  onNext,
  onPrevious,
  onComplete
}: OnboardingWalkthroughProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Prevent ESC key from closing (no skip option)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        // Do nothing - prevent closing
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen])

  if (!isOpen) return null

  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === totalSteps - 1

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop - non-clickable */}
      <div className="fixed inset-0 bg-black opacity-40 transition-opacity" />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress Bar */}
          <div className="h-2 bg-gray-200">
            <div 
              className="h-full bg-[var(--gg-primary)] transition-all duration-300"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            {/* Step Indicator */}
            <div className="text-center mb-6">
              <span className="text-sm font-medium text-gray-500">
                Step {currentStep + 1} of {totalSteps}
              </span>
            </div>

            {/* Icon */}
            {step.icon && (
              <div className="text-center mb-6">
                <span className="text-6xl">{step.icon}</span>
              </div>
            )}

            {/* Title */}
            <h2 className="gg-heading-section text-center mb-4">
              {step.title}
            </h2>

            {/* Description */}
            <p className="gg-text-body text-center mb-6 text-gray-700">
              {step.description}
            </p>

            {/* Tips */}
            {step.tips && step.tips.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Quick Tips:
                </h3>
                <ul className="space-y-2">
                  {step.tips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <svg 
                        className="h-5 w-5 text-[var(--gg-primary)] flex-shrink-0 mt-0.5" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                        />
                      </svg>
                      <span className="text-sm text-gray-600">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 mt-8">
              {!isFirstStep && (
                <button
                  onClick={onPrevious}
                  className="gg-btn-outline flex-1"
                >
                  <svg 
                    className="h-5 w-5 inline-block mr-2" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M15 19l-7-7 7-7" 
                    />
                  </svg>
                  Previous
                </button>
              )}
              
              {isLastStep ? (
                <button
                  onClick={onComplete}
                  className="gg-btn-primary flex-1"
                >
                  Finish Tutorial
                  <svg 
                    className="h-5 w-5 inline-block ml-2" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M5 13l4 4L19 7" 
                    />
                  </svg>
                </button>
              ) : isFirstStep ? (
                <button
                  onClick={onNext}
                  className="gg-btn-primary flex-1"
                >
                  Get Started
                  <svg 
                    className="h-5 w-5 inline-block ml-2" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 5l7 7-7 7" 
                    />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={onNext}
                  className="gg-btn-primary flex-1"
                >
                  Next
                  <svg 
                    className="h-5 w-5 inline-block ml-2" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 5l7 7-7 7" 
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


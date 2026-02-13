'use client'

import { useState } from 'react'
import OnboardingWalkthrough from '@/components/OnboardingWalkthrough'
import { completeOnboardingWalkthrough } from './actions'
import { walkthroughSteps } from './walkthroughContent'

export default function WalkthroughWrapper() {
  const [showWalkthrough, setShowWalkthrough] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)

  const handleNextStep = () => {
    if (currentStep < walkthroughSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleCompleteWalkthrough = async () => {
    const result = await completeOnboardingWalkthrough()
    if (result.success) {
      setShowWalkthrough(false)
    } else {
      alert('Failed to complete walkthrough. Please try again.')
    }
  }

  if (!showWalkthrough) return null

  return (
    <OnboardingWalkthrough
      isOpen={showWalkthrough}
      currentStep={currentStep}
      totalSteps={walkthroughSteps.length}
      step={walkthroughSteps[currentStep]}
      onNext={handleNextStep}
      onPrevious={handlePreviousStep}
      onComplete={handleCompleteWalkthrough}
      onClose={handleCompleteWalkthrough}
    />
  )
}

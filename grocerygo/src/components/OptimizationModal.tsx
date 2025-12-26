'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface OptimizationModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function OptimizationModal({ isOpen, onClose }: OptimizationModalProps) {
  const router = useRouter()

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  const handleGoToDashboard = () => {
    onClose()
    router.push('/dashboard')
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all duration-200 scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="mb-6">
            <div className="inline-flex h-16 w-16 animate-spin rounded-full border-4 border-solid border-[var(--gg-primary)] border-r-transparent"></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Optimizing Your Meal Plan
          </h2>
          <p className="text-gray-600 mb-2">
            Our AI is now optimizing each recipe according to your goals and preferences.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            This will take a few minutes to finish. You can wait here or return to your dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="gg-btn-primary flex-1"
            >
              Wait Here
            </button>
            <button
              onClick={handleGoToDashboard}
              className="gg-btn-outline flex-1"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { submitMealPlanFeedback } from '@/app/actions/feedbackHelper'
import { sanitizeUserInput } from '@/utils/sanitize'

interface MealPlanFeedbackProps {
  mealPlanId: string
  userId: string
  existingFeedback?: {
    id: string
    rating: number
    feedback_text: string | null
    would_make_again: boolean | null
    created_at: string
  } | null
}

export default function MealPlanFeedback({ mealPlanId, userId, existingFeedback }: MealPlanFeedbackProps) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  
  // Initialize state from existing feedback or defaults
  const [rating, setRating] = useState<number>(existingFeedback?.rating || 3)
  const [feedbackText, setFeedbackText] = useState<string>(existingFeedback?.feedback_text || '')
  const [wouldMakeAgain, setWouldMakeAgain] = useState<boolean | null>(existingFeedback?.would_make_again ?? null)
  const [initialThumbsUp, setInitialThumbsUp] = useState<boolean | null>(
    existingFeedback ? (existingFeedback.rating >= 3 ? true : false) : null
  )

  // Handle click outside to close form
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        // Check if click is not on thumbs buttons
        const target = event.target as HTMLElement
        if (!target.closest('button[aria-label="Thumbs up"]') && !target.closest('button[aria-label="Thumbs down"]')) {
          setIsExpanded(false)
          setError(null)
          setSuccess(false)
          // Reset to existing feedback if available
          if (existingFeedback) {
            setRating(existingFeedback.rating)
            setFeedbackText(existingFeedback.feedback_text || '')
            setWouldMakeAgain(existingFeedback.would_make_again ?? null)
            setInitialThumbsUp(existingFeedback.rating >= 3 ? true : false)
          } else {
            // Reset to defaults
            setRating(3)
            setFeedbackText('')
            setWouldMakeAgain(null)
            setInitialThumbsUp(null)
          }
        }
      }
    }

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isExpanded, existingFeedback])

  const handleThumbsClick = (isThumbsUp: boolean) => {
    setInitialThumbsUp(isThumbsUp)
    setRating(isThumbsUp ? 4 : 2)
    setIsExpanded(true)
    setError(null)
    setSuccess(false)
  }

  const handleFeedbackTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const input = e.target.value
    // Only allow alphanumeric characters and !, ., ,, (, )
    const filtered = input.replace(/[^a-zA-Z0-9!.,()\s]/g, '')
    setFeedbackText(filtered)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      // Sanitize feedback text before submission
      const sanitizedFeedback = feedbackText.trim() 
        ? sanitizeUserInput(feedbackText.trim())
        : undefined

      // Convert null to undefined for wouldMakeAgain
      const wouldMakeAgainValue = wouldMakeAgain !== null ? wouldMakeAgain : undefined

      const result = await submitMealPlanFeedback(
        mealPlanId,
        userId,
        rating,
        sanitizedFeedback,
        wouldMakeAgainValue
      )

      if (result.success) {
        setSuccess(true)
        // Refresh page data to show updated feedback
        router.refresh()
        // Collapse after a short delay
        setTimeout(() => {
          setIsExpanded(false)
          setSuccess(false)
        }, 2000)
      } else {
        setError(result.error || 'Failed to submit feedback')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = () => {
    setIsExpanded(true)
    setError(null)
    setSuccess(false)
  }

  return (
    <div className="flex items-center gap-3 justify-end">
      <span className="gg-text-body text-sm font-medium">Do you like this meal plan:</span>
      
      {/* Thumbs Up/Down Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleThumbsClick(true)}
          disabled={isSubmitting}
          className={`p-2 rounded-lg transition-all ${
            initialThumbsUp === true
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Thumbs up"
        >
          <span className="text-xl">👍</span>
        </button>
        <button
          onClick={() => handleThumbsClick(false)}
          disabled={isSubmitting}
          className={`p-2 rounded-lg transition-all ${
            initialThumbsUp === false
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Thumbs down"
        >
          <span className="text-xl">👎</span>
        </button>
      </div>


      {/* Expanded Feedback Form */}
      {isExpanded && (
        <div 
          ref={formRef}
          className="absolute top-full right-0 mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-lg p-6 z-50 min-w-[400px] max-w-[600px]"
        >
          <div className="space-y-4">
            <h3 className="gg-heading-section text-lg">Share Your Feedback</h3>

            {/* Rating Slider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rating: {rating}/5
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative flex items-center" style={{ height: '18px' }}>
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-2 bg-gray-200 rounded-lg" />
                  </div>
                  <div 
                    className="absolute left-0 h-2 rounded-lg bg-green-500 pointer-events-none transition-all duration-150"
                    style={{ 
                      width: `${((rating - 1) / 4) * 100}%`,
                      top: '50%',
                      transform: 'translateY(-50%)'
                    }}
                  />
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="gg-range-slider relative w-full cursor-pointer"
                    style={{ height: '18px' }}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`text-lg ${
                        star <= rating ? 'text-green-500' : 'text-gray-300'
                      }`}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Feedback Text */}
            <div>
              <label htmlFor="feedback-text" className="block text-sm font-medium text-gray-700 mb-2">
                Additional Comments (Optional)
              </label>
              <textarea
                id="feedback-text"
                value={feedbackText}
                onChange={handleFeedbackTextChange}
                placeholder="Tell us what you liked or what could be improved..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gg-primary)] focus:border-transparent resize-none"
                disabled={isSubmitting}
              />
            </div>

            {/* Would Make Again Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Would make this meal plan again
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setWouldMakeAgain(true)}
                  disabled={isSubmitting}
                  className={`p-2 rounded-lg transition-all ${
                    wouldMakeAgain === true
                      ? 'bg-green-100 text-green-700 border-2 border-green-500'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                  } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Would make again"
                >
                  <span className="text-lg">👍</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWouldMakeAgain(false)}
                  disabled={isSubmitting}
                  className={`p-2 rounded-lg transition-all ${
                    wouldMakeAgain === false
                      ? 'bg-red-100 text-red-700 border-2 border-red-500'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                  } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Would not make again"
                >
                  <span className="text-lg">👎</span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">Feedback submitted successfully!</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 justify-end pt-2">
              <button
                onClick={() => {
                  setIsExpanded(false)
                  setError(null)
                  setSuccess(false)
                  // Reset to existing feedback if available
                  if (existingFeedback) {
                    setRating(existingFeedback.rating)
                    setFeedbackText(existingFeedback.feedback_text || '')
                    setWouldMakeAgain(existingFeedback.would_make_again ?? null)
                    setInitialThumbsUp(existingFeedback.rating >= 3 ? true : false)
                  } else {
                    // Reset to defaults
                    setRating(3)
                    setFeedbackText('')
                    setWouldMakeAgain(null)
                    setInitialThumbsUp(null)
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--gg-primary)] rounded-lg hover:bg-[var(--gg-primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


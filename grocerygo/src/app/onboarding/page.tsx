'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveSurveyResponse } from './actions'

interface Question {
  id: number
  type: 'multiple-choice' | 'multiple-select' | 'ranking'
  question: string
  description?: string
  options: string[]
  maxSelections?: number
}

interface Section {
  title: string
  questions: Question[]
}

const sections: Section[] = [
  {
    title: "Personal Information",
    questions: [
      {
        id: 1,
        type: 'multiple-choice',
        question: 'What is your age range?',
        options: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'],
      },
      {
        id: 2,
        type: 'multiple-choice',
        question: 'How many people are you cooking for?',
        options: ['Just me', '2 people', '3-4 people', '5+ people'],
      },
    ],
  },
  {
    title: "Meal Planning Preferences",
    questions: [
      {
        id: 3,
        type: 'multiple-choice',
        question: 'What is your weekly meal planning budget?',
        options: ['$50-100', '$101-200', '$201-300', '$301+'],
      },
      {
        id: 4,
        type: 'multiple-choice',
        question: 'What is your cooking skill level?',
        options: [
          'Beginner (Basic cooking skills)',
          'Intermediate (Comfortable with most recipes)',
          'Advanced (Confident with complex techniques)'
        ],
      },
      {
        id: 5,
        type: 'multiple-choice',
        question: 'What is your average time available for meal preparation?',
        options: [
          'Quick (15-30 minutes)',
          'Standard (30-45 minutes)',
          'Extended (45+ minutes)'
        ],
      },
    ],
  },
  {
    title: "Dietary Preferences",
    questions: [
      {
        id: 6,
        type: 'multiple-select',
        question: 'Dietary restrictions: (Select all that apply)',
        options: [
          'No restrictions',
          'Vegetarian',
          'Vegan',
          'Gluten-free',
          'Dairy-free',
          'Keto/Low-carb',
          'Paleo',
          'Other'
        ],
      },
      {
        id: 7,
        type: 'multiple-select',
        question: 'Food allergies or intolerances: (Select all that apply)',
        options: [
          'None',
          'Nuts',
          'Shellfish',
          'Eggs',
          'Soy',
          'Wheat',
          'Other'
        ],
      },
      {
        id: 8,
        type: 'multiple-select',
        question: 'Flavor preferences: (Select up to 3)',
        options: [
          'Spicy',
          'Sweet',
          'Savory',
          'Tangy/Acidic',
          'Mild',
          'Umami/Rich'
        ],
        maxSelections: 3,
      },
    ],
  },
  {
    title: "Scheduling",
    questions: [
      {
        id: 9,
        type: 'multiple-select',
        question: 'What are your main goals with meal planning?',
        options: [
          'Save time on meal planning',
          'Eat healthier',
          'Learn new recipes',
          'Save money on groceries',
          'Reduce food waste',
          'Other',
        ],
      },
      {
        id: 10,
        type: 'multiple-select',
        question: 'Preferred grocery delivery days: (Select up to 2)',
        options: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday'
        ],
        maxSelections: 2,
      },
    ],
  },
  {
    title: "Priorities",
    questions: [
      {
        id: 11,
        type: 'ranking',
        question: "What's most important to you in meal planning? (Rank your top 3)",
        description: "Use the up/down buttons to arrange by importance. Your #1 choice is most important.",
        options: [
          'Cost efficiency',
          'Time saving',
          'Nutrition'
        ],
      },
    ],
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentSection, setCurrentSection] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({})

  const currentSectionData = sections[currentSection]
  const isLastSection = currentSection === sections.length - 1

  const handleMultipleChoice = (questionId: number, option: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }))
  }

  const handleMultipleSelect = (questionId: number, option: string, maxSelections?: number) => {
    setAnswers(prev => {
      const current = (prev[questionId] as string[]) || []
      const isSelected = current.includes(option)
      
      if (isSelected) {
        return { ...prev, [questionId]: current.filter(o => o !== option) }
      } else {
        if (maxSelections && current.length >= maxSelections) {
          return prev // Don't add if max reached
        }
        return { ...prev, [questionId]: [...current, option] }
      }
    })
  }

  const handleRanking = (questionId: number, options: string[], direction: 'up' | 'down', index: number) => {
    const current = (answers[questionId] as string[]) || [...options]
    const newRanking = [...current]
    
    if (direction === 'up' && index > 0) {
      [newRanking[index], newRanking[index - 1]] = [newRanking[index - 1], newRanking[index]]
    } else if (direction === 'down' && index < newRanking.length - 1) {
      [newRanking[index], newRanking[index + 1]] = [newRanking[index + 1], newRanking[index]]
    }
    
    setAnswers(prev => ({ ...prev, [questionId]: newRanking }))
  }

  const canProceed = () => {
    return currentSectionData.questions.every(q => {
      const answer = answers[q.id]
      if (!answer) return false
      if (Array.isArray(answer)) return answer.length > 0
      return true
    })
  }

  const handleNext = async () => {
    if (isLastSection) {
      // Save answers and redirect to dashboard
      console.log('Final answers:', answers)
      const result = await saveSurveyResponse(answers)
      
      if (result.success) {
        router.push('/dashboard')
      } else {
        console.error('Failed to save survey:', result.error)
        // You might want to show an error message to the user here
        alert('Failed to save your survey. Please try again.')
      }
    } else {
      setCurrentSection(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentSection > 0) {
      setCurrentSection(prev => prev - 1)
    }
  }

  return (
    <div className="gg-bg-page min-h-screen">
      <div className="gg-container">
        <div className="gg-section">
          
          {/* Header */}
          <div className="mb-12 text-center">
            <p className="gg-text-subtitle">Let&apos;s personalize your meal planning experience</p>
          </div>

          {/* Progress Bar */}
          <div className="mx-auto mb-8 max-w-3xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="gg-text-body text-sm">
                Step {currentSection + 1} of {sections.length}
              </span>
              <span className="gg-text-body text-sm">
                {Math.round(((currentSection + 1) / sections.length) * 100)}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div 
                className="h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${((currentSection + 1) / sections.length) * 100}%`,
                  backgroundColor: 'var(--gg-primary)'
                }}
              />
            </div>
          </div>

          {/* Quiz Content */}
          <div className="mx-auto max-w-3xl">
            <div className="gg-card mb-8">
              <h2 className="gg-heading-section mb-8">{currentSectionData.title}</h2>
              
              <div className="space-y-8">
                {currentSectionData.questions.map((question) => (
                  <div key={question.id} className="border-b border-gray-200 pb-8 last:border-b-0 last:pb-0">
                    <h3 className="gg-heading-card mb-4">{question.question}</h3>
                    
                    {question.description && (
                      <p className="gg-text-body mb-4 text-sm">{question.description}</p>
                    )}

                    {question.type === 'multiple-select' && question.maxSelections && (
                      <p className="gg-text-body mb-4 text-sm">
                        {((answers[question.id] as string[])?.length || 0)}/{question.maxSelections} selected
                      </p>
                    )}
                    
                    {/* Multiple Choice */}
                    {question.type === 'multiple-choice' && (
                      <div className="space-y-3">
                        {question.options.map((option) => {
                          const isSelected = answers[question.id] === option
                          return (
                            <button
                              key={option}
                              onClick={() => handleMultipleChoice(question.id, option)}
                              className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                                isSelected
                                  ? 'border-[var(--gg-primary)] bg-[var(--gg-primary)] bg-opacity-5'
                                  : 'border-gray-200 hover:border-[var(--gg-primary)] hover:border-opacity-50'
                              }`}
                            >
                              <div className="flex items-center">
                                <div className={`mr-3 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                                  isSelected ? 'border-[var(--gg-primary)]' : 'border-gray-300'
                                }`}>
                                  {isSelected && (
                                    <div className="h-3 w-3 rounded-full bg-[var(--gg-primary)]" />
                                  )}
                                </div>
                                <span className="gg-text-body">{option}</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Multiple Select */}
                    {question.type === 'multiple-select' && (
                      <div className="space-y-3">
                        {question.options.map((option) => {
                          const selected = (answers[question.id] as string[]) || []
                          const isSelected = selected.includes(option)
                          const isMaxed = question.maxSelections && selected.length >= question.maxSelections && !isSelected || false
                          
                          return (
                            <button
                              key={option}
                              onClick={() => handleMultipleSelect(question.id, option, question.maxSelections)}
                              disabled={isMaxed}
                              className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                                isSelected
                                  ? 'border-[var(--gg-primary)] bg-[var(--gg-primary)] bg-opacity-5'
                                  : isMaxed
                                  ? 'border-gray-200 opacity-50 cursor-not-allowed'
                                  : 'border-gray-200 hover:border-[var(--gg-primary)] hover:border-opacity-50'
                              }`}
                            >
                              <div className="flex items-center">
                                <div className={`mr-3 h-5 w-5 rounded border-2 flex items-center justify-center ${
                                  isSelected ? 'border-[var(--gg-primary)] bg-[var(--gg-primary)]' : 'border-gray-300'
                                }`}>
                                  {isSelected && (
                                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <span className="gg-text-body">{option}</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Ranking */}
                    {question.type === 'ranking' && (
                      <div className="space-y-3">
                        {((answers[question.id] as string[]) || question.options).map((option, index) => (
                          <div
                            key={option}
                            className="flex items-center gap-3 rounded-xl border-2 border-gray-200 bg-white p-4"
                          >
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => handleRanking(question.id, question.options, 'up', index)}
                                disabled={index === 0}
                                className={`rounded p-1 ${
                                  index === 0
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-[var(--gg-primary)] hover:bg-gray-100'
                                }`}
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleRanking(question.id, question.options, 'down', index)}
                                disabled={index === question.options.length - 1}
                                className={`rounded p-1 ${
                                  index === question.options.length - 1
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-[var(--gg-primary)] hover:bg-gray-100'
                                }`}
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--gg-primary)] text-white font-semibold text-sm">
                              {index + 1}
                            </div>
                            <span className="gg-text-body flex-1">{option}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between gap-4">
              {currentSection > 0 ? (
                <button onClick={handleBack} className="gg-btn-outline">
                  Back
                </button>
              ) : (
                <div />
              )}
              
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className={`gg-btn-primary ${!canProceed() ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLastSection ? "Let's Go!" : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SurveyResponse } from '@/types/database'
import { updateSurveyResponse } from './actions'
import { questions } from '@/app/schemas/userPreferenceQuestions'
import IngredientAutocomplete from '@/components/IngredientAutocomplete'

const questionConfigs = questions

interface PreferencesClientProps {
  surveyResponse: SurveyResponse | null
}

export default function PreferencesClient({
  surveyResponse,
}: PreferencesClientProps) {
  const [showSurveyDropdown, setShowSurveyDropdown] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string | string[]>('')
  const [isSaving, setIsSaving] = useState(false)

  const toggleSurveyDropdown = () => {
    setShowSurveyDropdown(!showSurveyDropdown)
  }

  const formatSurveyValue = (value: string | string[]) => {
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    return value
  }

  const capitalizeWords = (str: string) => {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  const handleEditStart = (questionId: string, currentValue: string | string[]) => {
    setEditingQuestion(questionId)
    const config = questionConfigs[questionId]
    if (config?.type === 'removable-list' || config?.type === 'multiple-select' || config?.type === 'ranking' || config?.type === 'autocomplete-ingredients') {
      setEditValue(Array.isArray(currentValue) ? currentValue : [])
    } else {
      setEditValue(currentValue)
    }
  }

  const handleEditCancel = () => {
    setEditingQuestion(null)
    setEditValue('')
  }

  const handleEditSave = async (questionId: string) => {
    setIsSaving(true)
    try {
      const result = await updateSurveyResponse(questionId, editValue)
      if (result.success) {
        setEditingQuestion(null)
        setEditValue('')
      } else {
        alert(result.error || 'Failed to update preference')
      }
    } catch (error) {
      console.error('Error updating preference:', error)
      alert('Failed to update preference')
    } finally {
      setIsSaving(false)
    }
  }

  const handleMultipleSelect = (option: string, maxSelections?: number) => {
    const current = (editValue as string[]) || []
    const isSelected = current.includes(option)
    
    if (isSelected) {
      setEditValue(current.filter(o => o !== option))
    } else {
      if (maxSelections && current.length >= maxSelections) {
        return
      }
      setEditValue([...current, option])
    }
  }

  const handleRanking = (direction: 'up' | 'down', index: number) => {
    const current = [...(editValue as string[])]
    
    if (direction === 'up' && index > 0) {
      [current[index], current[index - 1]] = [current[index - 1], current[index]]
    } else if (direction === 'down' && index < current.length - 1) {
      [current[index], current[index + 1]] = [current[index + 1], current[index]]
    }
    
    setEditValue(current)
  }

  const handleRemoveItem = (item: string) => {
    const current = (editValue as string[]) || []
    setEditValue(current.filter(i => i !== item))
  }

  return (
    <div className="gg-card">
      <button
        onClick={toggleSurveyDropdown}
        className="flex w-full items-center justify-between"
      >
        <h2 className="gg-heading-section">My Preferences</h2>
        <svg 
          className={`h-5 w-5 text-gray-600 transition-transform ${showSurveyDropdown ? 'rotate-180' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showSurveyDropdown && surveyResponse && (
        <div className="mt-6 space-y-4 border-t border-gray-200 pt-6">
          {Object.entries({
            ...surveyResponse,
            '12': surveyResponse['12'] || surveyResponse.favored_ingredients || [],
            '13': surveyResponse['13'] || surveyResponse.excluded_ingredients || [],
          })
          .filter(([questionId]) => {
            return questionId !== 'favored_ingredients' && questionId !== 'excluded_ingredients'
          })
          .map(([questionId, answer]) => {
            const config = questionConfigs[questionId]
            const isEditing = editingQuestion === questionId
            
            if (!config) return null
            
            return (
              <div key={questionId} className="pb-4 border-b border-gray-100 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">
                    {config.label}
                  </p>
                  {!isEditing && (
                    <button
                      onClick={() => handleEditStart(questionId, answer)}
                      className="text-xs text-[var(--gg-primary)] hover:underline flex items-center gap-1"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Edit
                    </button>
                  )}
                </div>

                {!isEditing ? (
                  <div>
                    {(config.type === 'removable-list' || config.type === 'autocomplete-ingredients') && Array.isArray(answer) && answer.length === 0 ? (
                      <p className="gg-text-body text-sm text-gray-400 italic">None</p>
                    ) : (config.type === 'removable-list' || config.type === 'autocomplete-ingredients') && Array.isArray(answer) ? (
                      <p className="gg-text-body text-sm">
                        {answer.map(item => capitalizeWords(item)).join(', ')}
                      </p>
                    ) : (
                      <p className="gg-text-body text-sm">
                        {formatSurveyValue(answer)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 mt-3">
                    {/* Multiple Choice */}
                    {config.type === 'multiple-choice' && (
                      <div className="space-y-2">
                        {config.options.map((option) => {
                          const isSelected = editValue === option
                          return (
                            <button
                              key={option}
                              onClick={() => setEditValue(option)}
                              className={`w-full rounded-lg border-2 p-3 text-left text-sm transition-all bg-white ${
                                isSelected
                                  ? 'border-[var(--gg-primary)]'
                                  : 'border-gray-200 hover:border-[var(--gg-primary)] hover:border-opacity-50'
                              }`}
                            >
                              <div className="flex items-center">
                                <div className={`mr-2 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                                  isSelected ? 'border-[var(--gg-primary)]' : 'border-gray-300'
                                }`}>
                                  {isSelected && (
                                    <div className="h-2 w-2 rounded-full bg-[var(--gg-primary)]" />
                                  )}
                                </div>
                                <span>{option}</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Multiple Select */}
                    {config.type === 'multiple-select' && (
                      <div className="space-y-2">
                        {config.maxSelections && (
                          <p className="text-xs text-gray-500 mb-2">
                            {((editValue as string[])?.length || 0)}/{config.maxSelections} selected
                          </p>
                        )}
                        {config.options.map((option) => {
                          const selected = (editValue as string[]) || []
                          const isSelected = selected.includes(option)
                          const isMaxed = config.maxSelections && selected.length >= config.maxSelections && !isSelected || false
                          
                          return (
                            <button
                              key={option}
                              onClick={() => handleMultipleSelect(option, config.maxSelections)}
                              disabled={isMaxed}
                              className={`w-full rounded-lg border-2 p-3 text-left text-sm transition-all bg-white ${
                                isSelected
                                  ? 'border-[var(--gg-primary)]'
                                  : isMaxed
                                  ? 'border-gray-200 opacity-50 cursor-not-allowed'
                                  : 'border-gray-200 hover:border-[var(--gg-primary)] hover:border-opacity-50'
                              }`}
                            >
                              <div className="flex items-center">
                                <div className={`mr-2 h-4 w-4 rounded border-2 flex items-center justify-center ${
                                  isSelected ? 'border-[var(--gg-primary)] bg-[var(--gg-primary)]' : 'border-gray-300'
                                }`}>
                                  {isSelected && (
                                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <span>{option}</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Ranking */}
                    {config.type === 'ranking' && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 mb-2">
                          Use arrows to rank by importance (#1 is most important)
                        </p>
                        {(editValue as string[]).map((option, index) => (
                          <div
                            key={option}
                            className="flex items-center gap-2 rounded-lg border-2 border-gray-200 bg-white p-3"
                          >
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => handleRanking('up', index)}
                                disabled={index === 0}
                                className={`rounded p-0.5 ${
                                  index === 0
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-[var(--gg-primary)] hover:bg-gray-100'
                                }`}
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleRanking('down', index)}
                                disabled={index === (editValue as string[]).length - 1}
                                className={`rounded p-0.5 ${
                                  index === (editValue as string[]).length - 1
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-[var(--gg-primary)] hover:bg-gray-100'
                                }`}
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--gg-primary)] text-white font-semibold text-xs">
                              {index + 1}
                            </div>
                            <span className="text-sm flex-1">{option}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Removable List */}
                    {config.type === 'removable-list' && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 mb-2">
                          Click the × button to remove ingredients
                        </p>
                        {(editValue as string[]).length > 0 ? (
                          <div className="space-y-2">
                            {(editValue as string[]).map((item) => (
                              <div
                                key={item}
                                className="flex items-center justify-between gap-3 rounded-lg border-2 border-gray-200 bg-white p-3"
                              >
                                <span className="text-sm flex-1">{capitalizeWords(item)}</span>
                                <button
                                  onClick={() => handleRemoveItem(item)}
                                  className="flex-shrink-0 rounded-full p-1 text-red-500 hover:bg-red-50 transition-colors"
                                  title="Remove"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center">
                            <p className="text-sm text-gray-500">No items to display</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Autocomplete Ingredients */}
                    {config.type === 'autocomplete-ingredients' && (
                      <IngredientAutocomplete
                        value={(editValue as string[]) || []}
                        onChange={(ingredients) => setEditValue(ingredients)}
                        placeholder="Type to search ingredients..."
                      />
                    )}

                    {/* Save/Cancel Buttons */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleEditSave(questionId)}
                        disabled={isSaving}
                        className="gg-btn-primary flex-1"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleEditCancel}
                        disabled={isSaving}
                        className="gg-btn-outline flex-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showSurveyDropdown && !surveyResponse && (
        <div className="mt-6 border-t border-gray-200 pt-6">
          <p className="gg-text-body text-sm mb-4">You haven&apos;t completed the survey yet.</p>
          <Link href="/onboarding" className="block w-full">
            <button className="gg-btn-primary w-full">
              Complete Survey
            </button>
          </Link>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import type { Recipe } from '@/types/database'
import RecipeAdjustments from './RecipeAdjustments'

interface RecipeModalProps {
  recipe: Recipe
  isOpen: boolean
  onClose: () => void
  // Optional callbacks for recipe adjustments
  onScaleServings?: (recipeId: string, multiplier: number) => void
  onSwapIngredient?: (recipeId: string, oldIngredient: string, newIngredient: string) => void
  onSimplifySteps?: (recipeId: string) => void
}

export default function RecipeModal({ 
  recipe, 
  isOpen, 
  onClose,
  onScaleServings,
  onSwapIngredient,
  onSimplifySteps
}: RecipeModalProps) {
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden' // Prevent background scroll
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black opacity-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-start justify-between z-10">
            <div className="flex-1 pr-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                {recipe.name}
              </h2>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                {recipe.prep_time_minutes && (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-[var(--gg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">{recipe.prep_time_minutes} minutes</span>
                  </span>
                )}
                {recipe.servings && (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-[var(--gg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="font-medium">{recipe.servings} servings</span>
                  </span>
                )}
                {recipe.difficulty && (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-[var(--gg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="font-medium capitalize">{recipe.difficulty}</span>
                  </span>
                )}
              </div>
            </div>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Close modal"
            >
              <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-8 py-6 pb-8 overflow-y-auto max-h-[calc(90vh-100px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Ingredients */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="h-6 w-6 text-[var(--gg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Ingredients
                </h3>
                <div className="space-y-3">
                  {recipe.ingredients.map((ingredient, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--gg-primary)] text-white text-xs font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {ingredient.item}
                        </p>
                        <p className="text-sm text-gray-600">
                          {ingredient.quantity}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="h-6 w-6 text-[var(--gg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Instructions
                </h3>
                <div className="space-y-4">
                  {recipe.steps.map((step, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-4"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gg-primary)] text-white text-sm font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <p className="flex-1 text-gray-700 leading-relaxed pt-1">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Nutrition Info (if available) */}
            {recipe.nutrition_info && (
              <div className="mt-8 p-6 rounded-xl bg-gradient-to-br from-green-50 to-blue-50 border border-green-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="h-6 w-6 text-[var(--gg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Nutrition Facts
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {recipe.nutrition_info.calories && (
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-[var(--gg-primary)]">
                        {recipe.nutrition_info.calories}
                      </p>
                      <p className="text-sm text-gray-600">Calories</p>
                    </div>
                  )}
                  {recipe.nutrition_info.protein && (
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-[var(--gg-primary)]">
                        {recipe.nutrition_info.protein}g
                      </p>
                      <p className="text-sm text-gray-600">Protein</p>
                    </div>
                  )}
                  {recipe.nutrition_info.carbs && (
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-[var(--gg-primary)]">
                        {recipe.nutrition_info.carbs}g
                      </p>
                      <p className="text-sm text-gray-600">Carbs</p>
                    </div>
                  )}
                  {recipe.nutrition_info.fat && (
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-[var(--gg-primary)]">
                        {recipe.nutrition_info.fat}g
                      </p>
                      <p className="text-sm text-gray-600">Fat</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recipe Adjustments */}
            {(onScaleServings || onSwapIngredient || onSimplifySteps) && (
              <div className="mt-8">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="h-6 w-6 text-[var(--gg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Customize This Recipe
                </h3>
                <RecipeAdjustments
                  recipeId={recipe.id}
                  currentServings={recipe.servings || 4}
                  ingredients={recipe.ingredients}
                  onScaleServings={onScaleServings}
                  onSwapIngredient={onSwapIngredient}
                  onSimplifySteps={onSimplifySteps}
                />
              </div>
            )}

            {/* Tags (if available) */}
            {(recipe.dietary_tags || recipe.cuisine_type || recipe.flavor_profile) && (
              <div className="mt-6 flex flex-wrap gap-2">
                {recipe.dietary_tags?.map((tag) => (
                  <span 
                    key={tag}
                    className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
                {recipe.cuisine_type?.map((cuisine) => (
                  <span 
                    key={cuisine}
                    className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-sm font-medium"
                  >
                    {cuisine}
                  </span>
                ))}
                {recipe.flavor_profile?.map((flavor) => (
                  <span 
                    key={flavor}
                    className="px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-sm font-medium"
                  >
                    {flavor}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


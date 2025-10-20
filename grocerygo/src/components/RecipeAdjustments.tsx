'use client'

import { useState } from 'react'

interface RecipeAdjustmentsProps {
  recipeId: string
  currentServings: number
  ingredients: Array<{
    item: string
    quantity: string
  }>
  onScaleServings?: (recipeId: string, multiplier: number) => void
  onSwapIngredient?: (recipeId: string, oldIngredient: string, newIngredient: string) => void
  onSimplifySteps?: (recipeId: string) => void
}

export default function RecipeAdjustments({
  recipeId,
  currentServings,
  ingredients,
  onScaleServings,
  onSwapIngredient,
  onSimplifySteps
}: RecipeAdjustmentsProps) {
  // COMMENTED OUT: Scale servings state and handlers
  // const [selectedMultiplier, setSelectedMultiplier] = useState(1)
  // const [isScaling, setIsScaling] = useState(false)
  // const [isSimplifying, setIsSimplifying] = useState(false)

  // const scaleOptions = [
  //   { label: '0.5x', value: 0.5 },
  //   { label: '1x', value: 1 },
  //   { label: '2x', value: 2 },
  //   { label: '3x', value: 3 }
  // ]

  // const handleScale = (multiplier: number) => {
  //   if (onScaleServings && multiplier !== selectedMultiplier) {
  //     setIsScaling(true)
  //     setSelectedMultiplier(multiplier)
  //     onScaleServings(recipeId, multiplier)
  //     // Reset will happen when parent updates
  //     setTimeout(() => setIsScaling(false), 1000)
  //   }
  // }

  // COMMENTED OUT: Simplify recipe functionality
  // const handleSimplify = () => {
  //   if (onSimplifySteps) {
  //     setIsSimplifying(true)
  //     onSimplifySteps(recipeId)
  //   }
  // }

  return (
    <div className="space-y-4">
      {/* COMMENTED OUT: Scale Servings functionality (may be added back later) */}
      {/* <div className="border-2 border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-semibold text-gray-900">Scale Servings</h4>
            <p className="text-sm text-gray-600">
              Current: {Math.round(currentServings * selectedMultiplier)} servings
            </p>
          </div>
          {isScaling && (
            <svg
              className="animate-spin h-5 w-5 text-[var(--gg-primary)]"
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
          )}
        </div>
        <div className="flex gap-2">
          {scaleOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleScale(option.value)}
              disabled={isScaling}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                selectedMultiplier === option.value
                  ? 'bg-[var(--gg-primary)] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Ingredients and shopping list will update automatically
        </p>
      </div> */}

      {/* COMMENTED OUT: Swap Ingredients functionality (may be added back later) */}
      {/* <div className="border-2 border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">Swap Ingredients</h4>
        <p className="text-sm text-gray-600 mb-3">
          Click on any ingredient to find alternatives
        </p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {ingredients.slice(0, 5).map((ingredient, idx) => (
            <IngredientSwapButton
              key={idx}
              ingredient={ingredient.item}
              onSwap={(newIngredient) => {
                if (onSwapIngredient) {
                  onSwapIngredient(recipeId, ingredient.item, newIngredient)
                }
              }}
            />
          ))}
          {ingredients.length > 5 && (
            <p className="text-sm text-gray-400 text-center py-2">
              +{ingredients.length - 5} more ingredients
            </p>
          )}
        </div>
      </div> */}

      {/* COMMENTED OUT: Simplify Recipe functionality (may be added back later) */}
      {/* <div className="border-2 border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-semibold text-gray-900">Simplify Recipe</h4>
            <p className="text-sm text-gray-600">
              Get suggestions for store-bought alternatives
            </p>
          </div>
          <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <button
          onClick={handleSimplify}
          disabled={isSimplifying}
          className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:border-[var(--gg-primary)] hover:text-[var(--gg-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSimplifying ? (
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
              Simplifying...
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Get Simpler Version
            </>
          )}
        </button>
      </div> */}
    </div>
  )
}

// COMMENTED OUT: IngredientSwapButton component (may be added back later)
// interface IngredientSwapButtonProps {
//   ingredient: string
//   onSwap: (newIngredient: string) => void
// }

// function IngredientSwapButton({ ingredient, onSwap }: IngredientSwapButtonProps) {
//   const [showSuggestions, setShowSuggestions] = useState(false)
//   
//   // Mock suggestions - in real implementation, these would come from AI
//   const suggestions = [
//     `Organic ${ingredient}`,
//     `${ingredient} (alternative brand)`,
//     'Substitute option'
//   ]

//   return (
//     <div className="relative">
//       <button
//         onClick={() => setShowSuggestions(!showSuggestions)}
//         className="w-full px-3 py-2 rounded-lg bg-gray-50 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-between group"
//       >
//         <span className="truncate">{ingredient}</span>
//         <svg
//           className={`h-4 w-4 text-gray-400 group-hover:text-[var(--gg-primary)] transition-transform ${
//             showSuggestions ? 'rotate-180' : ''
//           }`}
//           fill="none"
//           viewBox="0 0 24 24"
//           stroke="currentColor"
//         >
//           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
//         </svg>
//       </button>
//       
//       {showSuggestions && (
//         <div className="absolute left-0 right-0 mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg p-2 space-y-1 z-10">
//           {suggestions.map((suggestion, idx) => (
//             <button
//               key={idx}
//               onClick={() => {
//                 onSwap(suggestion)
//                 setShowSuggestions(false)
//               }}
//               className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-[var(--gg-primary)] hover:text-white rounded transition-colors"
//             >
//               {suggestion}
//             </button>
//           ))}
//         </div>
//       )}
//     </div>
//   )
// }


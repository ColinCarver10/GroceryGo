'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import RecipeCardSkeleton from '@/components/RecipeCardSkeleton'
import { saveGeneratedRecipes } from '../actions'

interface GeneratingViewProps {
  mealPlanId: string
  weekOf: string
  totalMeals: number
  surveySnapshot?: Record<string, any>
}

interface RecipeData {
  name: string
  mealType?: string
  ingredients: Array<{
    item: string
    quantity: string
  }>
  steps: string[]
  description?: string
  prep_time_minutes?: number
  cook_time_minutes?: number
  servings?: number
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  cuisine_type?: string[]
  dietary_tags?: string[]
  flavor_profile?: string[]
  estimated_cost?: number
  nutrition_info?: {
    calories?: number
    protein?: number
    carbs?: number
    fat?: number
  }
}

interface GroceryListItem {
  item: string
  quantity: string
}

export default function GeneratingView({
  mealPlanId,
  weekOf,
  totalMeals,
  surveySnapshot
}: GeneratingViewProps) {
  const router = useRouter()
  const [recipes, setRecipes] = useState<(RecipeData | null)[]>(
    Array(totalMeals).fill(null)
  )
  const [groceryList, setGroceryList] = useState<GroceryListItem[]>([])
  const [currentRecipeIndex, setCurrentRecipeIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamBuffer, setStreamBuffer] = useState('')
  
  // Use ref to track the actual count to prevent flickering
  const recipeCountRef = useRef(0)
  // Track if generation has started to prevent double execution in Strict Mode
  const hasStartedGenerationRef = useRef(false)

  useEffect(() => {
    // Only run once, even in Strict Mode
    if (!hasStartedGenerationRef.current) {
      hasStartedGenerationRef.current = true
      generateMealPlan()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tryParsePartialRecipes = (buffer: string) => {
    try {
      // Extract JSON from markdown if present
      let jsonContent = buffer
      const jsonMatch = buffer.match(/```json\s*([\s\S]*?)(?:```|$)/)
      if (jsonMatch) {
        jsonContent = jsonMatch[1]
      }

      // Try to extract recipes from breakfast, lunch, and dinner arrays
      const allRecipeObjects: string[] = []
      
      // Extract each meal type array
      for (const mealType of ['breakfast', 'lunch', 'dinner']) {
        const arrayMatch = jsonContent.match(new RegExp(`"${mealType}"\\s*:\\s*\\[([\\s\\S]*?)(?:\\]|$)`))
        if (!arrayMatch) continue
        
        let recipesContent = arrayMatch[1]
        
        // Parse recipe objects from this array
        let depth = 0
        let inString = false
        let escapeNext = false
        let currentObj = ''
        let inRecipeObject = false
        
        for (let i = 0; i < recipesContent.length; i++) {
          const char = recipesContent[i]
          
          if (escapeNext) {
            escapeNext = false
            currentObj += char
            continue
          }
          
          if (char === '\\') {
            escapeNext = true
            currentObj += char
            continue
          }
          
          if (char === '"') {
            inString = !inString
            currentObj += char
            continue
          }
          
          if (inString) {
            currentObj += char
            continue
          }
          
          if (char === '{') {
            depth++
            if (depth === 1) {
              inRecipeObject = true
              currentObj = '{'
            } else {
              currentObj += char
            }
          } else if (char === '}') {
            currentObj += char
            depth--
            if (depth === 0 && inRecipeObject) {
              // Complete recipe object
              allRecipeObjects.push(currentObj)
              currentObj = ''
              inRecipeObject = false
            }
          } else if (inRecipeObject) {
            currentObj += char
          }
        }
      }
      
      // Parse complete recipe objects - ONLY parse new ones beyond current index
      if (allRecipeObjects.length > recipeCountRef.current) {
        // Only parse the NEW recipes we haven't seen yet
        const newRecipeObjects = allRecipeObjects.slice(recipeCountRef.current)
        const newParsedRecipes: RecipeData[] = []
        
        for (const recipeStr of newRecipeObjects) {
          try {
            const recipe = JSON.parse(recipeStr)
            if (recipe.name && recipe.ingredients && recipe.steps) {
              newParsedRecipes.push(recipe)
            }
          } catch (e) {
            // Skip malformed recipes - this is expected during streaming
            break // Stop parsing if we hit an incomplete recipe
          }
        }
        
        if (newParsedRecipes.length > 0) {
          // Add ONLY the new recipes, don't touch existing ones
          const startIndex = recipeCountRef.current
          setRecipes(prev => {
            const newRecipes = [...prev]
            for (let i = 0; i < newParsedRecipes.length; i++) {
              const index = startIndex + i
              if (index < totalMeals && newRecipes[index] === null) {
                newRecipes[index] = newParsedRecipes[i]
              }
            }
            return newRecipes
          })
          
          // Update ref first, then state (prevents flickering)
          recipeCountRef.current = startIndex + newParsedRecipes.length
          setCurrentRecipeIndex(recipeCountRef.current)
        }
      }
    } catch (e) {
      // Silently fail - this is expected during streaming
    }
  }

  const generateMealPlan = async () => {
    try {
      // TODO: HAVE THIS MATCH THE EXACT MEAL TYPES FROM THE SURVEY
      const mealSelection = surveySnapshot?.meal_selection || {
        breakfast: Math.floor(totalMeals / 3),
        lunch: Math.floor(totalMeals / 3),
        dinner: totalMeals - (2 * Math.floor(totalMeals / 3))
      }

      const mealSchedule = surveySnapshot?.meal_schedule || []

      const response = await fetch('/api/generate-meal-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          weekOf,
          mealSelection,
          mealSchedule,
          mealPlanId
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to start meal plan generation')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response stream available')
      }

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        
        // AI SDK text stream is just plain text, not in a special format
        buffer += chunk
        setStreamBuffer(buffer)
        
        // Try to parse partial JSON to show recipes as they complete
        tryParsePartialRecipes(buffer)
      }

      // Parse the complete response
      await parseCompleteResponse(buffer)
      setIsComplete(true)

    } catch (err: any) {
      console.error('Generation error:', err)
      setError(err.message || 'Failed to generate meal plan')
    }
  }

  const parseCompleteResponse = async (buffer: string) => {
    try {
      if (!buffer || buffer.trim().length === 0) {
        setError('No response received from AI')
        return
      }

      // Extract JSON from markdown code blocks if present
      const jsonMatch = buffer.match(/```json\n?([\s\S]*?)\n?```/) || buffer.match(/```\n?([\s\S]*?)\n?```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : buffer
      
      const aiResponse = JSON.parse(jsonStr.trim())

      // Merge breakfast, lunch, and dinner arrays into single recipes array
      const allRecipes: RecipeData[] = []
      
      if (aiResponse.breakfast && Array.isArray(aiResponse.breakfast)) {
        allRecipes.push(...aiResponse.breakfast)
      }
      if (aiResponse.lunch && Array.isArray(aiResponse.lunch)) {
        allRecipes.push(...aiResponse.lunch)
      }
      if (aiResponse.dinner && Array.isArray(aiResponse.dinner)) {
        allRecipes.push(...aiResponse.dinner)
      }

      if (allRecipes.length > 0) {
        setRecipes(allRecipes)
        setCurrentRecipeIndex(allRecipes.length)
      }

      if (aiResponse.grocery_list && Array.isArray(aiResponse.grocery_list)) {
        setGroceryList(aiResponse.grocery_list)
      }

      // Auto-save after parsing
      await saveRecipes(allRecipes, aiResponse.grocery_list)
    } catch (err) {
      console.error('Parse error:', err)
      console.error('Buffer content:', buffer)
      console.error('Buffer length:', buffer.length)
      setError(`Failed to parse AI response: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const saveRecipes = async (recipesToSave: RecipeData[], groceryListToSave: GroceryListItem[]) => {
    setIsSaving(true)
    
    try {
      const result = await saveGeneratedRecipes(
        mealPlanId,
        recipesToSave,
        groceryListToSave
      )

      if (result.success) {
        // Wait a moment for the animation, then redirect
        setTimeout(() => {
          router.push(`/meal-plan/${mealPlanId}`)
        }, 1500)
      } else {
        setError(result.error || 'Failed to save recipes')
        setIsSaving(false)
      }
    } catch (err: any) {
      console.error('Save error:', err)
      setError(err.message || 'Failed to save recipes')
      setIsSaving(false)
    }
  }

  return (
    <div className="gg-bg-page min-h-screen relative">
      {/* Loading Overlay */}
      <div className="fixed inset-0 bg-white/40 backdrop-blur-[2px] z-40 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-6">
            <div className="inline-flex h-16 w-16 animate-spin rounded-full border-4 border-solid border-[var(--gg-primary)] border-r-transparent"></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isSaving ? 'Saving Your Meal Plan...' : 'Generating Your Personalized Meal Plan'}
          </h2>
          <p className="text-gray-600 mb-4">
            {isSaving 
              ? 'Almost done! Finalizing your recipes and grocery list...'
              : `Creating ${currentRecipeIndex} of ${totalMeals} recipes...`
            }
          </p>
          
          {/* Progress Bar */}
          <div className="w-80 mx-auto bg-gray-200 rounded-full h-2.5 mb-4">
            <div 
              className="bg-[var(--gg-primary)] h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${(currentRecipeIndex / totalMeals) * 100}%` }}
            ></div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Recipe Cards (Behind Overlay) */}
      <div className="gg-container">
        <div className="gg-section">
          <div className="mb-8">
            <h1 className="gg-heading-page mb-2">Your Meal Plan</h1>
            <p className="gg-text-subtitle">Week of {new Date(weekOf).toLocaleDateString()}</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe, index) => (
              <div 
                key={index} 
                className={`transition-all duration-500 ${
                  recipe ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
              >
                {recipe ? (
                  <div className="rounded-xl border-2 border-gray-200 bg-white p-6 hover:border-[var(--gg-primary)] hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Recipe Header */}
                    <div className="mb-4">
                      <h3 className="gg-heading-card mb-2">{recipe.name}</h3>
                      {recipe.mealType && (
                        <span className="inline-block rounded-full bg-[var(--gg-primary)] bg-opacity-10 px-3 py-1 text-xs font-medium text-[var(--gg-primary)]">
                          {recipe.mealType}
                        </span>
                      )}
                    </div>

                    {/* Meta Info */}
                    <div className="mb-4 flex flex-wrap gap-3 text-sm text-gray-600">
                      {recipe.prep_time_minutes && (
                        <span className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {recipe.prep_time_minutes}m
                        </span>
                      )}
                      {recipe.servings && (
                        <span className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {recipe.servings} servings
                        </span>
                      )}
                      {recipe.difficulty && (
                        <span className="capitalize">{recipe.difficulty}</span>
                      )}
                    </div>

                    {/* Ingredients Preview */}
                    <div>
                      <p className="mb-2 text-xs font-semibold text-gray-700">Ingredients:</p>
                      <ul className="space-y-1 text-sm text-gray-600">
                        {recipe.ingredients.slice(0, 3).map((ing, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-[var(--gg-primary)]">•</span>
                            <span className="truncate">{ing.item}</span>
                          </li>
                        ))}
                        {recipe.ingredients.length > 3 && (
                          <li className="text-gray-400 text-xs">
                            +{recipe.ingredients.length - 3} more...
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <RecipeCardSkeleton />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


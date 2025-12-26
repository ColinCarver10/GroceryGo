'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import RecipeCardSkeleton from '@/components/RecipeCardSkeleton'
import OptimizationModal from '@/components/OptimizationModal'
import { saveGeneratedRecipes } from '../actions'
import type { SurveyResponse } from '@/types/database'
import { getIngredients } from '@/utils/mealPlanUtils'

type SurveySnapshotData = SurveyResponse & {
  meal_selection?: {
    breakfast: number
    lunch: number
    dinner: number
  }
  distinct_recipe_counts?: {
    breakfast: number
    lunch: number
    dinner: number
  }
  selected_slots?: SelectedSlot[]
}

interface GeneratingViewProps {
  mealPlanId: string
  weekOf: string
  totalMeals: number
  surveySnapshot?: SurveySnapshotData
}

const DECAY_RATE = 0.001
interface RecipeData {
  id?: string
  recipe_id?: string
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

interface CandidateRecipe {
  recipe_id: string
  name: string
  meal_type?: string
  mealType?: string
  ingredients: Array<{
    item: string
    quantity: string
  }>
  steps: string[]
  description?: string
  nutrition?: {
    calories?: number
    protein?: number
    carbs?: number
    fat?: number
  }
}

interface SelectedSlot {
  day: string
  mealType: string
}

interface ScheduleEntry {
  slotLabel: string
  day: string
  mealType: string
  recipeId: string
  portionMultiplier: number
}

function getScheduledDay(weekOf: string, index: number) {
  const startDate = new Date(weekOf)
  if (Number.isNaN(startDate.getTime())) {
    return 'Unscheduled'
  }

  const mealDate = new Date(startDate)
  mealDate.setDate(startDate.getDate() + (index % 7))

  return mealDate.toLocaleDateString('en-US', {
    weekday: 'long'
  })
}

export function createDecayProgressSimulator(
  initialProgress = 0,
  decayRate = DECAY_RATE
) {
  let progress = initialProgress;

  return function getProgress(): number {
    // Remaining distance to completion
    const remaining = 1 - progress;

    // Add a shrinking increment
    progress += remaining * decayRate;

    // Cap so it never reaches 1.0 on its own
    return Math.min(progress, 0.99);
  };
}

export default function GeneratingView({
  mealPlanId,
  weekOf,
  totalMeals,
  surveySnapshot
}: GeneratingViewProps) {
  const router = useRouter()
  const [candidateRecipes, setCandidateRecipes] = useState<CandidateRecipe[]>([])
  const [optimizedRecipes, setOptimizedRecipes] = useState<Map<string, RecipeData>>(new Map())
  const [optimizationStatus, setOptimizationStatus] = useState<Map<string, 'optimizing' | 'complete'>>(new Map())
  const [isFetchingCandidates, setIsFetchingCandidates] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRecipeIndex, setCurrentRecipeIndex] = useState(1)
  const [overallProgress, setOverallProgress] = useState(0)
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false)
  const [showOptimizationModal, setShowOptimizationModal] = useState(false)
  const [currentStatusMessage, setCurrentStatusMessage] = useState(0)

  const recipeCountRef = useRef(0)
  const hasStartedGenerationRef = useRef(false)
  const hasFetchedCandidatesRef = useRef(false)
  const hasShownOptimizationModalRef = useRef(false)
  const uniqueRecipeIdsRef = useRef<Set<string>>(new Set())
  const candidateToOptimizedMapRef = useRef<Map<string, string>>(new Map())
  const progressSimulatorRef = useRef<ReturnType<typeof createDecayProgressSimulator> | null>(null)

  // Calculate total unique recipes expected
  const distinctRecipeCounts = surveySnapshot?.distinct_recipe_counts || {
    breakfast: Math.floor(totalMeals / 3),
    lunch: Math.floor(totalMeals / 3),
    dinner: totalMeals - 2 * Math.floor(totalMeals / 3)
  }
  const totalUniqueRecipes = distinctRecipeCounts.breakfast + distinctRecipeCounts.lunch + distinctRecipeCounts.dinner

  // Fetch candidate recipes immediately on mount
  useEffect(() => {
    if (!hasFetchedCandidatesRef.current) {
      hasFetchedCandidatesRef.current = true
      fetchCandidateRecipes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Start AI generation after candidates are fetched
  useEffect(() => {
    if (!isFetchingCandidates && candidateRecipes.length > 0 && !hasStartedGenerationRef.current) {
      hasStartedGenerationRef.current = true
      generateMealPlan()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFetchingCandidates, candidateRecipes.length])

  // Scroll to top after everything loads
  useEffect(() => {
    if (!isFetchingCandidates && candidateRecipes.length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [isFetchingCandidates, candidateRecipes.length])

  // Progress simulation using decay-based approach
  useEffect(() => {
    if (isFetchingCandidates) {
      progressSimulatorRef.current = null
      return
    }

    if (isSaving) {
      setOverallProgress(100)
      return
    }

    if (!progressSimulatorRef.current) {
      return
    }

    let progressInterval: NodeJS.Timeout

    const updateProgress = () => {
      if (!progressSimulatorRef.current) return

      // Get simulated progress from decay simulator (0-0.99 scale)
      const simulatedProgress = progressSimulatorRef.current()

      // Actual progress based on recipes received (0-1 scale)
      const recipeProgress = totalUniqueRecipes > 0 
        ? currentRecipeIndex / totalUniqueRecipes
        : 0

      // Use the higher of simulated or recipe progress, but cap at 0.95
      const totalProgress = Math.min(0.95, Math.max(simulatedProgress, recipeProgress))

      setOverallProgress(totalProgress)
    }

    progressInterval = setInterval(updateProgress, 100)
    updateProgress() // Initial update

    return () => {
      if (progressInterval) clearInterval(progressInterval)
    }
  }, [isFetchingCandidates, isSaving, currentRecipeIndex, totalUniqueRecipes])

  const fetchCandidateRecipes = async () => {
    try {
      setIsFetchingCandidates(true)
      setError(null)

      const mealSelection = surveySnapshot?.meal_selection || {
        breakfast: Math.floor(totalMeals / 3),
        lunch: Math.floor(totalMeals / 3),
        dinner: totalMeals - 2 * Math.floor(totalMeals / 3)
      }

      const distinctRecipeCounts = surveySnapshot?.distinct_recipe_counts || mealSelection

      const response = await fetch('/api/generate-meal-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mealSelection,
          mealPlanId,
          distinctRecipeCounts,
          fetchCandidatesOnly: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch candidate recipes')
      }

      const data = await response.json()
      const candidates: CandidateRecipe[] = data.candidates || []

      // Convert candidates to display format and set optimization status
      setCandidateRecipes(candidates)
      const statusMap = new Map<string, 'optimizing' | 'complete'>()
      candidates.forEach(candidate => {
        statusMap.set(candidate.recipe_id, 'optimizing')
      })
      setOptimizationStatus(statusMap)
      setIsFetchingCandidates(false)
      
      // Calculate initial progress: 1 / totalUniqueRecipes (0-1 scale)
      const totalRecipes = candidates.length
      const initialProgress = totalRecipes > 0 ? 1 / totalRecipes : 0
      progressSimulatorRef.current = createDecayProgressSimulator(initialProgress, DECAY_RATE)
      setOverallProgress(initialProgress)
    } catch (err) {
      console.error('Error fetching candidates:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch candidate recipes')
      setIsFetchingCandidates(false)
    }
  }

  const tryParsePartialRecipes = (buffer: string) => {
    try {
      let jsonContent = buffer
      const jsonMatch = buffer.match(/```json\s*([\s\S]*?)(?:```|$)/)
      if (jsonMatch) {
        jsonContent = jsonMatch[1]
      }

      const recipesMatch = jsonContent.match(/"recipes"\s*:\s*\[([\s\S]*)/)
      if (!recipesMatch) return

      const recipesContent = recipesMatch[1]
      let depth = 0
      let inString = false
      let escapeNext = false
      const recipeObjects: string[] = []
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
          depth += 1
          if (depth === 1) {
            inRecipeObject = true
            currentObj = '{'
          } else {
            currentObj += char
          }
        } else if (char === '}') {
          currentObj += char
          depth -= 1
          if (depth === 0 && inRecipeObject) {
            recipeObjects.push(currentObj)
            currentObj = ''
            inRecipeObject = false
          }
        } else if (inRecipeObject) {
          currentObj += char
        }
      }

      if (recipeObjects.length > recipeCountRef.current) {
        const newRecipeObjects = recipeObjects.slice(recipeCountRef.current)
        const newParsedRecipes: RecipeData[] = []

        for (const recipeStr of newRecipeObjects) {
          try {
            const recipe = JSON.parse(recipeStr) as RecipeData
            if (recipe.name && recipe.ingredients && recipe.steps) {
              newParsedRecipes.push(recipe)
            }
          } catch {
            break
          }
        }

        if (newParsedRecipes.length > 0) {
          // Mark that streaming has started
          if (!hasStartedStreaming) {
            setHasStartedStreaming(true)
          }

          // Update optimized recipes map and status
          setOptimizedRecipes(prev => {
            const updated = new Map(prev)
            const statusUpdated = new Map(optimizationStatus)
            
            newParsedRecipes.forEach((recipe) => {
              const recipeId = recipe.id || recipe.recipe_id || recipe.name
              if (recipeId) {
                updated.set(recipeId, recipe)
                statusUpdated.set(recipeId, 'complete')
                
                // Try to map back to candidate recipe_id
                candidateRecipes.forEach(candidate => {
                  if (candidate.name === recipe.name || candidate.recipe_id === recipeId) {
                    candidateToOptimizedMapRef.current.set(candidate.recipe_id, recipeId)
                    statusUpdated.set(candidate.recipe_id, 'complete')
                  }
                })
              }
            })
            
            setOptimizationStatus(statusUpdated)
            return updated
          })

          // Track unique recipes by ID or name
          newParsedRecipes.forEach((recipe) => {
            const uniqueKey = recipe.id || recipe.recipe_id || recipe.name
            if (uniqueKey && !uniqueRecipeIdsRef.current.has(uniqueKey)) {
              uniqueRecipeIdsRef.current.add(uniqueKey)
            }
          })

          recipeCountRef.current = recipeCountRef.current + newParsedRecipes.length
          // Ensure we show at least 1, or the actual count if higher
          setCurrentRecipeIndex(Math.max(1, uniqueRecipeIdsRef.current.size))
        }
      }
    } catch {
      // ignore partial parse errors during streaming
    }
  }

  const generateMealPlan = async () => {
    try {
      const mealSelection = surveySnapshot?.meal_selection || {
        breakfast: Math.floor(totalMeals / 3),
        lunch: Math.floor(totalMeals / 3),
        dinner: totalMeals - 2 * Math.floor(totalMeals / 3)
      }

      const distinctRecipeCounts = surveySnapshot?.distinct_recipe_counts || mealSelection

      const selectedSlots: SelectedSlot[] =
        surveySnapshot?.selected_slots ||
        Array.from({ length: mealSelection.breakfast }, (_, idx) => ({
          day: getScheduledDay(weekOf, idx),
          mealType: 'breakfast'
        }))
          .concat(
            Array.from({ length: mealSelection.lunch }, (_, idx) => ({
              day: getScheduledDay(weekOf, mealSelection.breakfast + idx),
              mealType: 'lunch'
            }))
          )
          .concat(
            Array.from({ length: mealSelection.dinner }, (_, idx) => ({
              day: getScheduledDay(
                weekOf,
                mealSelection.breakfast + mealSelection.lunch + idx
              ),
              mealType: 'dinner'
            }))
          )

      const response = await fetch('/api/generate-meal-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mealSelection,
          mealPlanId,
          distinctRecipeCounts,
          selectedSlots
        })
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
        buffer += chunk
        tryParsePartialRecipes(buffer)
      }

      await parseCompleteResponse(buffer)
    } catch (err) {
      console.error('Generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate meal plan')
    }
  }

  const parseCompleteResponse = async (buffer: string) => {
    try {
      if (!buffer || buffer.trim().length === 0) {
        setError('No response received from AI')
        return
      }

      const jsonMatch = buffer.match(/```json\n?([\s\S]*?)\n?```/) || buffer.match(/```\n?([\s\S]*?)\n?```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : buffer
      const aiResponse = JSON.parse(jsonStr.trim()) as {
        recipes?: RecipeData[]
        grocery_list?: Array<{ item: string; quantity: string }>
        schedule?: ScheduleEntry[]
      }

      if (!Array.isArray(aiResponse.schedule)) {
        setError('Meal plan generation did not include schedule details. Please try again.')
        return
      }

      if (aiResponse.schedule.length !== totalMeals) {
        setError(`Meal plan schedule mismatch. Expected ${totalMeals} slots, received ${aiResponse.schedule.length}.`)
        return
      }

      const parsedSchedule = aiResponse.schedule as ScheduleEntry[]
      const parsedRecipes = Array.isArray(aiResponse.recipes) ? aiResponse.recipes : []

      if (!parsedRecipes.length) {
        setError('Meal plan generation did not include any recipes. Please try again.')
        return
      }

      // Mark that streaming has started
      if (!hasStartedStreaming) {
        setHasStartedStreaming(true)
      }

      // Update optimized recipes map and mark all as complete
      setOptimizedRecipes(prev => {
        const updated = new Map(prev)
        const statusUpdated = new Map(optimizationStatus)
        
        parsedRecipes.forEach((recipe) => {
          const recipeId = recipe.id || recipe.recipe_id || recipe.name
          if (recipeId) {
            updated.set(recipeId, recipe)
            statusUpdated.set(recipeId, 'complete')
            
            // Map back to candidate recipe_id by matching name or ID
            candidateRecipes.forEach(candidate => {
              const candidateName = candidate.name.toLowerCase().trim()
              const recipeName = recipe.name.toLowerCase().trim()
              if (candidateName === recipeName || candidate.recipe_id === recipeId) {
                candidateToOptimizedMapRef.current.set(candidate.recipe_id, recipeId)
                statusUpdated.set(candidate.recipe_id, 'complete')
              }
            })
          }
        })
        
        setOptimizationStatus(statusUpdated)
        return updated
      })

      // Track unique recipes from final response
      parsedRecipes.forEach((recipe) => {
        const uniqueKey = recipe.id || recipe.recipe_id || recipe.name
        if (uniqueKey && !uniqueRecipeIdsRef.current.has(uniqueKey)) {
          uniqueRecipeIdsRef.current.add(uniqueKey)
        }
      })

      // Ensure we show at least 1, or the actual count if higher
      setCurrentRecipeIndex(Math.max(1, uniqueRecipeIdsRef.current.size))
      setOverallProgress(95) // Near completion when all recipes are parsed

      const groceryListItems = Array.isArray(aiResponse.grocery_list) ? aiResponse.grocery_list : []

      setOverallProgress(100) // Complete
      await saveRecipes(parsedRecipes, groceryListItems, parsedSchedule)
    } catch (err) {
      console.error('Parse error:', err)
      console.error('Buffer content:', buffer)
      console.error('Buffer length:', buffer.length)
      setError(`Failed to parse AI response: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const saveRecipes = async (
    recipesToSave: RecipeData[],
    groceryListToSave: Array<{ item: string; quantity: string }>,
    schedule: ScheduleEntry[]
  ) => {
    setIsSaving(true)

    try {
      const result = await saveGeneratedRecipes(
        mealPlanId,
        recipesToSave,
        groceryListToSave,
        schedule
      )

      if (result.success) {
        setTimeout(() => {
          router.push(`/meal-plan/${mealPlanId}`)
        }, 1500)
      } else {
        setError(result.error || 'Failed to save recipes')
        setIsSaving(false)
      }
    } catch (err) {
      console.error('Save error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save recipes')
      setIsSaving(false)
    }
  }

  // Get display recipes: use optimized version if available, otherwise use candidate
  const getDisplayRecipe = (candidate: CandidateRecipe): RecipeData => {
    const candidateId = candidate.recipe_id
    const optimizedId = candidateToOptimizedMapRef.current.get(candidateId)
    const optimized = optimizedId ? optimizedRecipes.get(optimizedId) : null
    
    if (optimized) {
      return optimized
    }
    
    // Convert candidate to RecipeData format
    return {
      id: candidate.recipe_id,
      recipe_id: candidate.recipe_id,
      name: candidate.name,
      mealType: candidate.mealType || candidate.meal_type,
      ingredients: candidate.ingredients,
      steps: candidate.steps,
      description: candidate.description,
      nutrition_info: candidate.nutrition
    }
  }

  const isOptimizing = (candidateId: string): boolean => {
    return optimizationStatus.get(candidateId) === 'optimizing'
  }

  // Group recipes by meal type
  const recipesByMealType = candidateRecipes.reduce((acc, candidate) => {
    const mealType = (candidate.mealType || candidate.meal_type || 'other').toLowerCase()
    if (!acc[mealType]) {
      acc[mealType] = []
    }
    acc[mealType].push(candidate)
    return acc
  }, {} as Record<string, CandidateRecipe[]>)

  // Define meal type order and labels
  const mealTypeOrder = ['breakfast', 'lunch', 'dinner']
  const mealTypeLabels: Record<string, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    other: 'Other'
  }

  // Dynamic status messages for optimization progress
  const statusMessages = [
    'Fine-tuning recipes...',
    'Optimizing ingredients...',
    'Calculating nutrition...',
    'Personalizing your plan...',
    'Adjusting portions...',
    'Aligning with your goals...'
  ]

  // Rotate status messages every few seconds during optimization
  useEffect(() => {
    if (!isFetchingCandidates && candidateRecipes.length > 0 && !isSaving) {
      const interval = setInterval(() => {
        setCurrentStatusMessage((prev) => (prev + 1) % statusMessages.length)
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [isFetchingCandidates, candidateRecipes.length, isSaving, statusMessages.length])

  // Show optimization modal after candidates are fetched
  useEffect(() => {
    if (!isFetchingCandidates && candidateRecipes.length > 0 && !hasShownOptimizationModalRef.current && !hasStartedStreaming) {
      hasShownOptimizationModalRef.current = true
      setShowOptimizationModal(true)
    }
  }, [isFetchingCandidates, candidateRecipes.length, hasStartedStreaming])

  return (
    <div className="gg-bg-page min-h-screen relative">
      {/* Loading overlay - only show while fetching candidates */}
      {isFetchingCandidates && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-[2px] z-40 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-6">
              <div className="inline-flex h-16 w-16 animate-spin rounded-full border-4 border-solid border-[var(--gg-primary)] border-r-transparent"></div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Fetching Your Recipes...
            </h2>
            <p className="text-gray-600 mb-4">
              Finding the perfect recipes for your meal plan
            </p>
          </div>
        </div>
      )}

      {/* Optimization Modal */}
      <OptimizationModal
        isOpen={showOptimizationModal}
        onClose={() => setShowOptimizationModal(false)}
      />

      {/* Saving overlay */}
      {isSaving && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-[2px] z-40 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-6">
              <div className="inline-flex h-16 w-16 animate-spin rounded-full border-4 border-solid border-[var(--gg-primary)] border-r-transparent"></div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Saving Your Meal Plan...
            </h2>
            <p className="text-gray-600 mb-4">
              Almost done! Finalizing your recipes and grocery list...
            </p>
          </div>
        </div>
      )}

      <div className="gg-container">
        <div className="gg-section">
          <div className="mb-8">
            <h1 className="gg-heading-page mb-2">Your Meal Plan</h1>
            <p className="gg-text-subtitle">Week of {new Date(weekOf).toLocaleDateString()}</p>
            {!isFetchingCandidates && candidateRecipes.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                {statusMessages[currentStatusMessage]} ({currentRecipeIndex} of {totalUniqueRecipes} recipes optimized)
              </p>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Overall progress bar above cards */}
          {!isFetchingCandidates && !isSaving && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">{statusMessages[currentStatusMessage]}</p>
                <p className="text-sm font-medium text-[var(--gg-primary)]">
                  {currentRecipeIndex} / {totalUniqueRecipes}
                </p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--gg-primary)] to-[var(--gg-primary)]/80 transition-all duration-500 ease-out relative"
                  style={{ width: `${overallProgress * 100}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </div>
              </div>
            </div>
          )}

          {candidateRecipes.length === 0 && !isFetchingCandidates ? (
            // Show skeletons while waiting
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: totalUniqueRecipes }).map((_, index) => (
                <RecipeCardSkeleton key={index} />
              ))}
            </div>
          ) : (
            // Organize recipes by meal type
            <div className="space-y-8">
              {mealTypeOrder.map((mealType) => {
                const recipes = recipesByMealType[mealType] || []
                if (recipes.length === 0) return null

                return (
                  <div key={mealType} className="space-y-4">
                    <h2 className="gg-heading-section">
                      {mealTypeLabels[mealType] || mealType}
                    </h2>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {recipes.map((candidate) => {
                        const displayRecipe = getDisplayRecipe(candidate)
                        const optimizing = isOptimizing(candidate.recipe_id)
                        const ingredients = getIngredients(displayRecipe as any)
                        
                        return (
                          <div
                            key={candidate.recipe_id}
                            className={`transition-all duration-500 opacity-100 ${
                              optimizing 
                                ? 'animate-pulse scale-[1.02]' 
                                : 'scale-100'
                            }`}
                          >
                            <div className={`rounded-xl border-2 bg-white p-6 hover:border-[var(--gg-primary)] hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-4 duration-500 relative overflow-hidden ${
                              optimizing 
                                ? 'border-[var(--gg-primary)]/50 shadow-sm' 
                                : 'border-gray-200'
                            }`}>
                              <div className="mb-2">
                                <h3 className="gg-heading-card mb-2 capitalize truncate">{displayRecipe.name}</h3>
                              </div>

                              <div>
                                <p className="mb-2 text-xs font-semibold text-gray-700">Ingredients:</p>
                                <ul className="space-y-1 text-sm text-gray-600 mb-5">
                                  {ingredients.slice(0, 5).map((ingredient, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <span className="text-[var(--gg-primary)]">•</span>
                                      <span className="truncate">{ingredient.ingredient}</span>
                                    </li>
                                  ))}
                                  {ingredients.length > 3 && (
                                    <li className="text-gray-400 text-xs">
                                      +{ingredients.length - 3} more...
                                    </li>
                                  )}
                                </ul>
                              </div>

                              {/* Bottom progress bar for optimization */}
                              {optimizing && (
                                <div className="absolute bottom-0 left-0 right-0 animate-in slide-in-from-bottom duration-300">
                                  <div className="h-1 bg-gray-100 relative overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-[var(--gg-primary)] via-[var(--gg-primary)]/80 to-[var(--gg-primary)] animate-pulse relative" style={{ width: '100%' }}>
                                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                                    </div>
                                  </div>
                                  <div className="bg-white px-4 py-2 flex items-center gap-2 border-t border-gray-100">
                                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-[var(--gg-primary)] border-r-transparent"></div>
                                    <span className="text-xs font-medium text-[var(--gg-primary)] animate-pulse">
                                      Optimizing with AI
                                    </span>
                                  </div>
                                </div>
                              )}
                              {!optimizing && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-100 opacity-0 animate-in fade-in duration-500">
                                  <div className="h-full bg-green-500" style={{ width: '100%' }} />
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {/* Show any recipes that don't match standard meal types */}
              {Object.keys(recipesByMealType).filter(type => !mealTypeOrder.includes(type)).map((mealType) => {
                const recipes = recipesByMealType[mealType] || []
                if (recipes.length === 0) return null

                return (
                  <div key={mealType} className="space-y-4">
                    <h2 className="gg-heading-section">
                      {mealTypeLabels[mealType] || mealType}
                    </h2>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {recipes.map((candidate) => {
                        const displayRecipe = getDisplayRecipe(candidate)
                        const optimizing = isOptimizing(candidate.recipe_id)
                        const ingredients = getIngredients(displayRecipe as any)
                        
                        return (
                          <div
                            key={candidate.recipe_id}
                            className={`transition-all duration-500 opacity-100 ${
                              optimizing 
                                ? 'animate-pulse scale-[1.02]' 
                                : 'scale-100'
                            }`}
                          >
                            <div className={`rounded-xl border-2 bg-white p-6 hover:border-[var(--gg-primary)] hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-4 duration-500 relative overflow-hidden ${
                              optimizing 
                                ? 'border-[var(--gg-primary)]/50 shadow-sm' 
                                : 'border-gray-200'
                            }`}>
                              <div className="mb-4">
                                <h3 className="gg-heading-card mb-2 capitalize truncate">{displayRecipe.name}</h3>
                              </div>

                              <div>
                                <p className="mb-2 text-xs font-semibold text-gray-700">Ingredients:</p>
                                <ul className="space-y-1 text-sm text-gray-600">
                                  {ingredients.slice(0, 3).map((ingredient, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <span className="text-[var(--gg-primary)]">•</span>
                                      <span className="truncate">{ingredient.ingredient}</span>
                                    </li>
                                  ))}
                                  {ingredients.length > 3 && (
                                    <li className="text-gray-400 text-xs">
                                      +{ingredients.length - 3} more...
                                    </li>
                                  )}
                                </ul>
                              </div>

                              {/* Bottom progress bar for optimization */}
                              {optimizing && (
                                <div className="absolute bottom-0 left-0 right-0 animate-in slide-in-from-bottom duration-300">
                                  <div className="h-1 bg-gray-100 relative overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-[var(--gg-primary)] via-[var(--gg-primary)]/80 to-[var(--gg-primary)] animate-pulse relative" style={{ width: '100%' }}>
                                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                                    </div>
                                  </div>
                                  <div className="bg-white px-4 py-2 flex items-center gap-2 border-t border-gray-100">
                                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-[var(--gg-primary)] border-r-transparent"></div>
                                    <span className="text-xs font-medium text-[var(--gg-primary)] animate-pulse">
                                      Optimizing with AI
                                    </span>
                                  </div>
                                </div>
                              )}
                              {!optimizing && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-100 opacity-0 animate-in fade-in duration-500">
                                  <div className="h-full bg-green-500" style={{ width: '100%' }} />
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


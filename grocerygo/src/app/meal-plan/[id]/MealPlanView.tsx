'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { MealPlanWithRecipes, Recipe, MealPlanRecipe } from '@/types/database'
import RecipeModal from '@/components/RecipeModal'
// import AdjustPlanPanel from '@/components/AdjustPlanPanel' // COMMENTED OUT: Adjust plan functionality hidden temporarily
import IngredientActions from '@/components/IngredientActions'
import MealSlotCard from '@/components/MealSlotCard'
import MealColumn, { mealTypeConfig } from '@/components/MealColumn'
import ReplaceRecipeChoiceModal from '@/components/ReplaceRecipeChoiceModal'
import SavedRecipeSelector from '@/components/SavedRecipeSelector'
import MealPlanFeedback from '@/components/MealPlanFeedback'
// import type { PlanAdjustments } from '@/components/AdjustPlanPanel' // COMMENTED OUT: Adjust plan functionality hidden temporarily
import { getRecipeSteps, organizeMealsByWeek, type WeekDayMeals } from '@/utils/mealPlanUtils';
import { 
  createInstacartOrder,
  replaceRecipe,
  replaceRecipeWithSaved,
  // regenerateWithAdjustments, // COMMENTED OUT: Adjust plan functionality hidden temporarily
  saveCookingNote,
  updateShoppingListItemChecked,
  // scaleRecipeServings, // COMMENTED OUT: Scale servings functionality
  // swapIngredient, // COMMENTED OUT: Swap ingredient functionality
  // simplifyRecipe // COMMENTED OUT: Simplify recipe functionality
} from './actions'
import { excludeIngredient, favorIngredient, saveRecipe, unsaveRecipe } from '@/app/actions/userPreferences'
import { useRouter } from 'next/navigation'
import { invalidateDashboardCache } from '@/app/dashboard/actions'

interface MealPlanViewProps {
  mealPlan: MealPlanWithRecipes
  savedRecipeIds: string[]
  totalIngredients: { items: Array<{ item: string; quantity: string; checked?: boolean }>; seasonings: Array<{ item: string; quantity: string; checked?: boolean }> }
  existingFeedback?: {
    id: string
    rating: number
    feedback_text: string | null
    would_make_again: boolean | null
    created_at: string
  } | null
}

export default function MealPlanView({ mealPlan, savedRecipeIds, totalIngredients, existingFeedback }: MealPlanViewProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'recipes' | 'shopping'>('recipes')
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [selectedRecipeSlots, setSelectedRecipeSlots] = useState<MealPlanRecipe[]>([])
  const [clickedSlotDate, setClickedSlotDate] = useState<string | null>(null)
  const [isOrderingInstacart, setIsOrderingInstacart] = useState(false)
  const [instacartError, setInstacartError] = useState<string | null>(null)
  const [movedSeasonings, setMovedSeasonings] = useState<Map<string, { item: string; quantity: string }>>(new Map())
  const [showInstacartModal, setShowInstacartModal] = useState(false)
  
  // COMMENTED OUT: Adjust plan functionality hidden temporarily
  // const [isAdjustPanelOpen, setIsAdjustPanelOpen] = useState(false)
  const [favoriteRecipes, setFavoriteRecipes] = useState<Set<string>>(new Set(savedRecipeIds))
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  
  // Sync favoriteRecipes state when props change (e.g., after router.refresh())
  useEffect(() => {
    setFavoriteRecipes(new Set(savedRecipeIds))
  }, [savedRecipeIds])
  
  // Initialize checkedItems from persisted data in totalIngredients
  // Also automatically move checked seasonings to the main shopping list
  useEffect(() => {
    const checkedSet = new Set<string>()
    const movedSeasoningsMap = new Map<string, { item: string; quantity: string }>()
    
    // Helper to create stable ID from item name
    const getItemId = (item: { item: string }, type: 'item' | 'seasoning') => {
      return type === 'item' ? `item-${item.item}` : `seasoning-${item.item}`
    }
    
    // Add checked items from items array
    totalIngredients.items.forEach(item => {
      if (item.checked) {
        checkedSet.add(`item-${item.item}`)
      }
    })
    
    // Add checked items from seasonings array
    // If a seasoning is checked, automatically move it to the main shopping list
    totalIngredients.seasonings.forEach(item => {
      const seasoningId = `seasoning-${item.item}`
      if (item.checked) {
        checkedSet.add(`seasoning-${item.item}`)
        // Also add the moved-seasoning ID so it shows as checked in the moved position
        checkedSet.add(`moved-seasoning-${item.item}`)
        // Add to movedSeasonings map
        movedSeasoningsMap.set(seasoningId, item)
      }
    })
    
    setCheckedItems(checkedSet)
    setMovedSeasonings(movedSeasoningsMap)
  }, [totalIngredients])
  
  // Replace recipe flow state
  const [showReplaceChoiceModal, setShowReplaceChoiceModal] = useState(false)
  const [showSavedRecipeSelector, setShowSavedRecipeSelector] = useState(false)
  const [replaceRecipeContext, setReplaceRecipeContext] = useState<{ recipeId: string; mealType: string } | null>(null)
  const [replacingRecipeIds, setReplacingRecipeIds] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  const toggleItem = async (itemId: string) => {
    // Extract item name and type from itemId
    // Format: "item-{name}" or "seasoning-{name}" or "moved-seasoning-{name}"
    const isMovedSeasoning = itemId.startsWith('moved-seasoning-')
    const isSeasoning = itemId.startsWith('seasoning-')
    
    let itemName: string
    let itemType: 'item' | 'seasoning'
    
    if (isMovedSeasoning) {
      itemName = itemId.replace('moved-seasoning-', '')
      // Moved seasonings are still stored in the seasonings array in the database
      // The "moved" state is just for UI presentation
      itemType = 'seasoning'
    } else if (isSeasoning) {
      itemName = itemId.replace('seasoning-', '')
      itemType = 'seasoning'
    } else {
      itemName = itemId.replace('item-', '')
      itemType = 'item'
    }
    
    // Optimistic update
    const wasChecked = checkedItems.has(itemId)
    setCheckedItems(prev => {
      const newSet = new Set(prev)
      if (wasChecked) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
    
    // Persist to server
    try {
      const result = await updateShoppingListItemChecked(
        mealPlan.id,
        itemName,
        !wasChecked,
        itemType
      )
      
      if (!result.success) {
        // Revert on error
        setCheckedItems(prev => {
          const newSet = new Set(prev)
          if (wasChecked) {
            newSet.add(itemId)
          } else {
            newSet.delete(itemId)
          }
          return newSet
        })
        console.error('Failed to update checked state:', result.error)
      } else {
        // Refresh to get updated data
        router.refresh()
      }
    } catch (error) {
      // Revert on error
      setCheckedItems(prev => {
        const newSet = new Set(prev)
        if (wasChecked) {
          newSet.add(itemId)
        } else {
          newSet.delete(itemId)
        }
        return newSet
      })
      console.error('Error updating checked state:', error)
    }
  }

  // Handler functions for new features
  const handleReplaceRecipe = async (recipeId: string, suggestedMealType?: string | null): Promise<void> => {
    // Find the meal type for this recipe
    const mealPlanRecipe = mealPlan.meal_plan_recipes.find(mpr => 
      String(mpr.recipe_id) === String(recipeId) || String(mpr.updated_recipe_id) === String(recipeId)
    )
    const mealType = suggestedMealType || mealPlanRecipe?.meal_type || 'dinner'
    
    // Store context and show choice modal (reset saved recipe selector state)
    setReplaceRecipeContext({ recipeId, mealType })
    setShowSavedRecipeSelector(false)
    setShowReplaceChoiceModal(true)
    // Mark this recipe as being replaced
    setReplacingRecipeIds(prev => new Set(prev).add(recipeId))
  }

  const handleGenerateNewRecipe = async () => {
    if (!replaceRecipeContext) return
    
    setIsProcessing(true)
    setActionError(null)
    
    const recipeId = replaceRecipeContext.recipeId
    
    try {
      const result = await replaceRecipe(mealPlan.id, recipeId, replaceRecipeContext.mealType)
      
      if (result.success) {
        router.refresh()
      } else {
        setActionError(result.error || 'Failed to replace recipe')
        // Reset replacing state on error
        setReplacingRecipeIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(recipeId)
          return newSet
        })
      }
    } catch (error) {
      setActionError('An unexpected error occurred:' + error)
      // Reset replacing state on error
      setReplacingRecipeIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(recipeId)
        return newSet
      })
    } finally {
      setIsProcessing(false)
      setReplacingRecipeIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(recipeId)
        return newSet
      })
      setReplaceRecipeContext(null)
    }
  }

  const handleReplaceWithSavedRecipe = () => {
    setShowReplaceChoiceModal(false)
    setShowSavedRecipeSelector(true)
  }

  const handleSavedRecipeSelected = async (savedRecipeId: string) => {
    if (!replaceRecipeContext) return
    
    setIsProcessing(true)
    setActionError(null)
    
    const recipeId = replaceRecipeContext.recipeId
    
    try {
      const result = await replaceRecipeWithSaved(
        mealPlan.id,
        recipeId,
        savedRecipeId,
        replaceRecipeContext.mealType
      )
      
      if (result.success) {
        router.refresh()
      } else {
        setActionError(result.error || 'Failed to replace recipe')
        // Reset replacing state on error
        setReplacingRecipeIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(recipeId)
          return newSet
        })
      }
    } catch (error) {
      setActionError('An unexpected error occurred:' + error)
      // Reset replacing state on error
      setReplacingRecipeIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(recipeId)
        return newSet
      })
    } finally {
      setIsProcessing(false)
      setReplacingRecipeIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(recipeId)
        return newSet
      })
      setReplaceRecipeContext(null)
    }
  }

  const handleToggleFavorite = async (recipeId: string, isFavorite: boolean) => {
    // Get recipe name for feedback tracking
    const recipe = mealPlan.meal_plan_recipes.find(mpr => mpr.recipe_id === recipeId)?.recipe
    const recipeName = recipe?.name || 'Unknown Recipe'
    
    // Optimistically update UI
    setFavoriteRecipes(prev => {
      const newSet = new Set(prev)
      if (isFavorite) {
        newSet.add(recipeId)
      } else {
        newSet.delete(recipeId)
      }
      return newSet
    })

    try {
      if (isFavorite) {
        const result = await saveRecipe(mealPlan.user_id, recipeId, recipeName, mealPlan.id)
        if (!result.success) {
          // Revert on error
          setFavoriteRecipes(prev => {
            const newSet = new Set(prev)
            newSet.delete(recipeId)
            return newSet
          })
          setActionError(result.error || 'Failed to save recipe')
        } else {
          // Invalidate cache and refresh page data to ensure consistency
          await invalidateDashboardCache()
          router.refresh()
        }
      } else {
        const result = await unsaveRecipe(mealPlan.user_id, recipeId, recipeName, mealPlan.id)
        if (!result.success) {
          // Revert on error
          setFavoriteRecipes(prev => {
            const newSet = new Set(prev)
            newSet.add(recipeId)
            return newSet
          })
          setActionError(result.error || 'Failed to unsave recipe')
        } else {
          // Invalidate cache and refresh page data to ensure consistency
          await invalidateDashboardCache()
          router.refresh()
        }
      }
    } catch (error) {
      // Revert on error
      setFavoriteRecipes(prev => {
        const newSet = new Set(prev)
        if (isFavorite) {
          newSet.delete(recipeId)
        } else {
          newSet.add(recipeId)
        }
        return newSet
      })
      setActionError('An unexpected error occurred' + error)
    }
  }

  // COMMENTED OUT: Adjust plan functionality hidden temporarily
  // const handleApplyAdjustments = async (adjustments: PlanAdjustments) => {
  //   setIsProcessing(true)
  //   setActionError(null)
  //   
  //   try {
  //     const result = await regenerateWithAdjustments(mealPlan.id, adjustments)
  //     
  //     if (result.success) {
  //       setIsAdjustPanelOpen(false)
  //       router.refresh()
  //     } else {
  //       setActionError(result.error || 'Failed to apply adjustments')
  //     }
  //   } catch (error) {
  //     setActionError('An unexpected error occurred' + error)
  //   } finally {
  //     setIsProcessing(false)
  //   }
  // }

  const handleExcludeIngredient = async (itemId: string, itemName: string) => {
    setIsProcessing(true)
    setActionError(null)
    
    try {
      // Get current user from mealPlan
      const result = await excludeIngredient(mealPlan.user_id, itemName)
      
      if (!result.success) {
        setActionError(result.error || 'Failed to exclude ingredient')
      }
    } catch (error) {
      setActionError('An unexpected error occurred' + error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFavorIngredient = async (itemId: string, itemName: string) => {
    setIsProcessing(true)
    setActionError(null)
    
    try {
      const result = await favorIngredient(mealPlan.user_id, itemName)
      
      if (!result.success) {
        setActionError(result.error || 'Failed to favor ingredient')
      }
    } catch (error) {
      setActionError('An unexpected error occurred' + error)
    } finally {
      setIsProcessing(false)
    }
  }

  // COMMENTED OUT: Scale servings functionality (may be added back later)
  // const handleScaleServings = async (recipeId: string, multiplier: number) => {
  //   setIsProcessing(true)
  //   setActionError(null)
  //   
  //   try {
  //     const result = await scaleRecipeServings(mealPlan.id, recipeId, multiplier)
  //     
  //     if (result.success) {
  //       router.refresh()
  //     } else {
  //       setActionError(result.error || 'Failed to scale recipe')
  //     }
  //   } catch (error) {
  //     setActionError('An unexpected error occurred')
  //   } finally {
  //     setIsProcessing(false)
  //   }
  // }

  // COMMENTED OUT: Swap ingredient functionality (may be added back later)
  // const handleSwapIngredient = async (recipeId: string, oldIngredient: string, newIngredient: string) => {
  //   setIsProcessing(true)
  //   setActionError(null)
  //   
  //   try {
  //     const result = await swapIngredient(mealPlan.id, recipeId, oldIngredient, newIngredient)
  //     
  //     if (result.success) {
  //       router.refresh()
  //     } else {
  //       setActionError(result.error || 'Failed to swap ingredient')
  //     }
  //   } catch (error) {
  //     setActionError('An unexpected error occurred')
  //   } finally {
  //     setIsProcessing(false)
  //   }
  // }

  // COMMENTED OUT: Simplify recipe functionality (may be added back later)
  // const handleSimplifySteps = async (recipeId: string) => {
  //   setIsProcessing(true)
  //   setActionError(null)
  //   
  //   try {
  //     const result = await simplifyRecipe(mealPlan.id, recipeId)
  //     
  //     if (result.success) {
  //       router.refresh()
  //     } else {
  //       setActionError(result.error || 'Failed to simplify recipe')
  //     }
  //   } catch (error) {
  //     setActionError('An unexpected error occurred')
  //   } finally {
  //     setIsProcessing(false)
  //   }
  // }

  // Handler for saving cooking notes from AI assistant
  const handleSaveCookingNote = async (recipeId: string, note: string) => {
    try {
      const result = await saveCookingNote(recipeId, note)
      
      if (result.success) {
        // Refresh the page to show updated notes
        router.refresh()
      } else {
        console.error('Failed to save cooking note:', result.error)
      }
    } catch (error) {
      console.error('Error saving cooking note:', error)
    }
  }

  const handleOrderInstacart = () => {
    // Go directly to Instacart (modal disabled)
    confirmOrderInstacart()
  }

  const confirmOrderInstacart = async () => {
    // Close modal
    setShowInstacartModal(false)

    // Combine main items and moved seasonings
    const allItems = [
      ...totalIngredients.items.map((item) => ({ ...item, type: 'item' as const, itemId: `item-${item.item}` })),
      ...Array.from(movedSeasonings.values()).map((item) => ({ ...item, type: 'seasoning' as const, itemId: `moved-seasoning-${item.item}` }))
    ]

    // Filter out checked items - only send unchecked items to Instacart
    // Convert total_ingredients to GroceryItem format for Instacart API
    const uncheckedItems = allItems
      .filter((item) => !checkedItems.has(item.itemId))
      .map((item, globalIndex) => {
        // Parse quantity string to extract number and unit
        const quantityMatch = item.quantity.match(/^([\d.]+)\s*(.+)?/)
        const quantity = quantityMatch ? parseFloat(quantityMatch[1]) : undefined
        const unit = quantityMatch && quantityMatch[2] ? quantityMatch[2].trim() : undefined
        
        return {
          id: `item-${globalIndex}`,
          meal_plan_id: mealPlan.id,
          item_name: item.item,
          quantity,
          unit,
          purchased: false
        }
      })
    
    if (uncheckedItems.length === 0) {
      setInstacartError('No unchecked items to order')
      return
    }

    setIsOrderingInstacart(true)
    setInstacartError(null)

    try {
      const mealPlanUrl = `${window.location.origin}/meal-plan/${mealPlan.id}`
      const mealPlanTitle = `Meal Plan for ${formatDate(mealPlan.week_of)}`
      
      const result = await createInstacartOrder(
        mealPlan.id,
        uncheckedItems as any,
        mealPlanTitle,
        mealPlanUrl
      )

      if (result.success && result.link) {
        // Try opening in new tab, fallback to same tab if blocked (common on mobile)
        const newWindow = window.open(result.link, '_blank')
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          window.location.href = result.link
        }
      } else {
        setInstacartError(result.error || 'Failed to create Instacart order')
      }
    } catch (error) {
      setInstacartError('An unexpected error occurred')
      console.error('Error ordering from Instacart:', error)
    } finally {
      setIsOrderingInstacart(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatMealPlanDateRange = (weekOf: string) => {
    if (!weekOf) return ''
    
    // Parse the start date from week_of (format: YYYY-MM-DD)
    const parts = weekOf.split('-')
    if (parts.length !== 3) return weekOf // Fallback if format is unexpected
    
    const [year, month, day] = parts.map(Number)
    if (isNaN(year) || isNaN(month) || isNaN(day)) return weekOf // Fallback if parsing fails
    
    const startDate = new Date(year, month - 1, day)
    
    // Validate date
    if (isNaN(startDate.getTime())) return weekOf // Fallback if invalid date
    
    // Calculate end date (7 days after start)
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6) // +6 because we want 7 days total (start + 6 more)
    
    // If same month, simplify: "January 25 - 31"
    if (startDate.getMonth() === endDate.getMonth()) {
      const startMonth = startDate.toLocaleDateString('en-US', { month: 'long' })
      const startDay = startDate.getDate()
      const endDay = endDate.getDate()
      return `${startMonth} ${startDay} - ${endDay}`
    }
    
    // Different months: "December 26 - January 1"
    const startFormatted = startDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric'
    })
    
    const endFormatted = endDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric'
    })
    
    return `${startFormatted} - ${endFormatted}`
  }

  const formatDateRange = (days: WeekDayMeals[]) => {
    if (days.length === 0) return ''
    
    const firstDay = days[0]
    const lastDay = days[days.length - 1]
    
    // Parse dates
    const [firstYear, firstMonth, firstDayNum] = firstDay.date.split('-').map(Number)
    const [lastYear, lastMonth, lastDayNum] = lastDay.date.split('-').map(Number)
    
    const firstDate = new Date(firstYear, firstMonth - 1, firstDayNum)
    const lastDate = new Date(lastYear, lastMonth - 1, lastDayNum)
    
    // Format first date
    const firstFormatted = firstDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
    
    // Format last date
    const lastFormatted = lastDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
    
    // If same month and year, simplify: "December 20 - 26, 2025"
    if (firstYear === lastYear && firstMonth === lastMonth) {
      const firstDayOnly = firstDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric'
      })
      const lastDayOnly = lastDate.toLocaleDateString('en-US', {
        day: 'numeric',
        year: 'numeric'
      })
      return `${firstDayOnly} - ${lastDayOnly}`
    }
    
    // Different months or years: "December 26, 2024 - January 1, 2025"
    return `${firstFormatted} - ${lastFormatted}`
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-100 text-green-800',
      'in-progress': 'bg-blue-100 text-blue-800',
      pending: 'bg-gray-100 text-gray-800',
      generating: 'bg-yellow-100 text-yellow-800'
    }
    const labels = {
      completed: 'Completed',
      'in-progress': 'In Progress',
      pending: 'Pending',
      generating: 'Generating...'
    }
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    )
  }

  // Organize meals by week
  const organizedWeek = organizeMealsByWeek(mealPlan)

  const handleCopyToClipboard = async () => {
    // Combine all items (regular items + moved seasonings)
    const allItems = [
      ...totalIngredients.items.map((item) => ({ ...item, itemId: `item-${item.item}` })),
      ...Array.from(movedSeasonings.values()).map((item) => ({ ...item, itemId: `moved-seasoning-${item.item}` }))
    ]

    // Filter out checked items
    const uncheckedItems = allItems.filter(item => !checkedItems.has(item.itemId))

    // Format as text
    const groceryListText = uncheckedItems
      .map(item => {
        if (item.quantity) {
          return `${item.item} (${item.quantity})`
        }
        return item.item
      })
      .join('\n')

    // Add header if there are items
    const fullText = uncheckedItems.length > 0
      ? `Grocery List\n${formatDateRange(organizedWeek.days)}\n\n${groceryListText}`
      : 'Grocery List\n(No items)'

    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = fullText
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        // Handle error silently
      }
      document.body.removeChild(textArea)
    }
  }

  const handleRecipeClick = (recipe: Recipe, slots: MealPlanRecipe[]) => {
    setSelectedRecipe(recipe)
    // Store the clicked slot's date to exclude it from "Also planned for" display
    const clickedDate = slots.length > 0 ? slots[0].planned_for_date ?? null : null
    setClickedSlotDate(clickedDate)
    // Find all meal plan recipes that use this same recipe
    // Use recipe_id from the clicked slot (parent id) which will be the same across all slots for the same recipe
    // Get recipe_id from the first slot passed in (the clicked slot)
    const recipeId = slots.length > 0 ? String(slots[0].recipe_id) : String(recipe.id)
    const allSlotsForRecipe = mealPlan.meal_plan_recipes.filter(
      mpr => String(mpr.recipe_id) === recipeId
    )
    // Fallback to the slots passed in if filter finds nothing (shouldn't happen, but safety check)
    setSelectedRecipeSlots(allSlotsForRecipe.length > 0 ? allSlotsForRecipe : slots)
  }

  const formatSlotLabel = (slot: MealPlanRecipe) => {
    if (slot.slot_label) return slot.slot_label
    const day = slot.planned_for_date
      ? new Date(slot.planned_for_date + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'long'
        })
      : 'Unscheduled'
    const meal = slot.meal_type ? slot.meal_type.charAt(0).toUpperCase() + slot.meal_type.slice(1) : 'Meal'
    return `${day} ${meal}`
  }

  const plannedSlotSummaries = selectedRecipeSlots.map(slot => ({
    label: formatSlotLabel(slot),
    portionMultiplier: slot.portion_multiplier ?? 1,
    plannedDate: slot.planned_for_date ?? null,
    mealType: slot.meal_type ?? undefined
  }))

  // Count unique recipes for tab label
  const uniqueRecipeIds = new Set(mealPlan.meal_plan_recipes.map(mpr => mpr.recipe_id))

  return (
    <div className="gg-bg-page min-h-screen">
      <div className="gg-container">
        <div className="gg-section">
          
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <Link 
              href="/dashboard" 
              className="gg-text-body text-sm mb-4 inline-flex items-center gap-2 hover:text-[var(--gg-primary)] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Link>
            
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <h1 className="gg-heading-page mb-2 text-xl sm:text-2xl lg:text-3xl">
                  <span className="hidden sm:inline">Meal Plan for </span>
                  <span className="sm:hidden">Plan: </span>
                  {formatMealPlanDateRange(mealPlan.week_of)}
                </h1>
                <p className="gg-text-subtitle text-xs sm:text-base">
                  <span className="hidden sm:inline">{mealPlan.total_meals} meal slot{mealPlan.total_meals === 1 ? '' : 's'} • {uniqueRecipeIds.size} unique recipe{uniqueRecipeIds.size === 1 ? '' : 's'} • Created {new Date(mealPlan.created_at).toLocaleDateString()}</span>
                  <span className="sm:hidden">{mealPlan.total_meals} meals • {uniqueRecipeIds.size} recipes</span>
                </p>
              </div>
              <div className="flex items-center sm:flex-col sm:items-end gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  {getStatusBadge(mealPlan.status)}
                </div>
                
                {/* Feedback Component */}
                <div className="relative">
                  <MealPlanFeedback 
                    mealPlanId={mealPlan.id} 
                    userId={mealPlan.user_id}
                    existingFeedback={existingFeedback}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200">
            <div className="flex gap-4 sm:gap-8">
              <button
                onClick={() => setActiveTab('recipes')}
                className={`pb-3 sm:pb-4 px-1 border-b-2 font-semibold transition-colors text-sm sm:text-base ${
                  activeTab === 'recipes'
                    ? 'border-[var(--gg-primary)] text-[var(--gg-primary)]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="hidden sm:inline">Recipes</span>
                  <span className="sm:hidden">Recipes</span>
                  <span className="text-xs sm:text-sm">({mealPlan.total_meals})</span>
                </span>
              </button>
              <button
                onClick={() => setActiveTab('shopping')}
                className={`pb-3 sm:pb-4 px-1 border-b-2 font-semibold transition-colors text-sm sm:text-base ${
                  activeTab === 'shopping'
                    ? 'border-[var(--gg-primary)] text-[var(--gg-primary)]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="hidden sm:inline">Shopping List</span>
                  <span className="sm:hidden">Shopping</span>
                  <span className="text-xs sm:text-sm">({totalIngredients.items.length + movedSeasonings.size})</span>
                </span>
              </button>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'recipes' ? (
            <div className="space-y-6">
              {/* Weekly Schedule Layout - Horizontal: Days as rows, Meals as columns */}
              <div className="space-y-4">
                {/* Header Row - Hidden on mobile */}
                <div className="hidden lg:grid lg:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2 justify-center">
                    <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="font-semibold text-yellow-900 uppercase text-sm tracking-wider">Breakfast</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold text-orange-900 uppercase text-sm tracking-wider">Lunch</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    <span className="font-semibold text-blue-900 uppercase text-sm tracking-wider">Dinner</span>
                  </div>
                </div>

                {/* Day Rows */}
                {organizedWeek.days.map((day) => {
                  const hasMeals = day.breakfast.length > 0 || day.lunch.length > 0 || day.dinner.length > 0
                  
                  return (
                    <div
                      key={day.date}
                      className="space-y-3"
                    >
                      {/* Day Header - Horizontal title spanning all columns */}
                      <div className="text-left">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{day.dayName}</h2>
                        <p className="text-sm text-gray-600">{day.dateDisplay}</p>
                      </div>

                      {/* No meals message */}
                      {!hasMeals && (
                        <div className="gg-card border-2 border-gray-200 bg-gray-50">
                          <p className="text-center text-gray-500 py-4">
                            No meals planned for {day.dayName}
                          </p>
                        </div>
                      )}

                      {/* Mobile/Tablet: Stack vertically */}
                      {hasMeals && (
                        <div className="lg:hidden space-y-3">
                          <MealColumn
                            mealType="breakfast"
                            meals={day.breakfast}
                            colorClasses={mealTypeConfig.breakfast.colorClasses}
                            icon={mealTypeConfig.breakfast.icon}
                            favoriteRecipes={favoriteRecipes}
                            onRecipeClick={handleRecipeClick}
                            onReplace={handleReplaceRecipe}
                            onToggleFavorite={handleToggleFavorite}
                            showMobileHeader={true}
                            allMealPlanRecipes={mealPlan.meal_plan_recipes}
                            replacingRecipeIds={replacingRecipeIds}
                          />
                          <MealColumn
                            mealType="lunch"
                            meals={day.lunch}
                            colorClasses={mealTypeConfig.lunch.colorClasses}
                            icon={mealTypeConfig.lunch.icon}
                            favoriteRecipes={favoriteRecipes}
                            onRecipeClick={handleRecipeClick}
                            onReplace={handleReplaceRecipe}
                            onToggleFavorite={handleToggleFavorite}
                            showMobileHeader={true}
                            allMealPlanRecipes={mealPlan.meal_plan_recipes}
                            replacingRecipeIds={replacingRecipeIds}
                          />
                          <MealColumn
                            mealType="dinner"
                            meals={day.dinner}
                            colorClasses={mealTypeConfig.dinner.colorClasses}
                            icon={mealTypeConfig.dinner.icon}
                            favoriteRecipes={favoriteRecipes}
                            onRecipeClick={handleRecipeClick}
                            onReplace={handleReplaceRecipe}
                            onToggleFavorite={handleToggleFavorite}
                            showMobileHeader={true}
                            allMealPlanRecipes={mealPlan.meal_plan_recipes}
                            replacingRecipeIds={replacingRecipeIds}
                          />
                        </div>
                      )}

                      {/* Desktop: Horizontal grid */}
                      {hasMeals && (
                        <div className="hidden lg:grid lg:grid-cols-3 gap-4">
                          <MealColumn
                            mealType="breakfast"
                            meals={day.breakfast}
                            colorClasses={mealTypeConfig.breakfast.colorClasses}
                            icon={mealTypeConfig.breakfast.icon}
                            favoriteRecipes={favoriteRecipes}
                            onRecipeClick={handleRecipeClick}
                            onReplace={handleReplaceRecipe}
                            onToggleFavorite={handleToggleFavorite}
                            showMobileHeader={false}
                            minHeight="min-h-[200px]"
                            allMealPlanRecipes={mealPlan.meal_plan_recipes}
                            replacingRecipeIds={replacingRecipeIds}
                          />
                          <MealColumn
                            mealType="lunch"
                            meals={day.lunch}
                            colorClasses={mealTypeConfig.lunch.colorClasses}
                            icon={mealTypeConfig.lunch.icon}
                            favoriteRecipes={favoriteRecipes}
                            onRecipeClick={handleRecipeClick}
                            onReplace={handleReplaceRecipe}
                            onToggleFavorite={handleToggleFavorite}
                            showMobileHeader={false}
                            minHeight="min-h-[200px]"
                            allMealPlanRecipes={mealPlan.meal_plan_recipes}
                            replacingRecipeIds={replacingRecipeIds}
                          />
                          <MealColumn
                            mealType="dinner"
                            meals={day.dinner}
                            colorClasses={mealTypeConfig.dinner.colorClasses}
                            icon={mealTypeConfig.dinner.icon}
                            favoriteRecipes={favoriteRecipes}
                            onRecipeClick={handleRecipeClick}
                            onReplace={handleReplaceRecipe}
                            onToggleFavorite={handleToggleFavorite}
                            showMobileHeader={false}
                            minHeight="min-h-[200px]"
                            allMealPlanRecipes={mealPlan.meal_plan_recipes}
                            replacingRecipeIds={replacingRecipeIds}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Unscheduled Meals Section */}
              {organizedWeek.unscheduled.length > 0 && (
                <div className="gg-card border-2 border-gray-200">
                  <h3 className="gg-heading-section mb-6">Unscheduled Meals</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {organizedWeek.unscheduled.map((mpr) => (
                      <MealSlotCard
                        key={mpr.id}
                        mealPlanRecipe={mpr}
                        favoriteRecipes={favoriteRecipes}
                        onRecipeClick={handleRecipeClick}
                        onReplace={handleReplaceRecipe}
                        onToggleFavorite={handleToggleFavorite}
                        allMealPlanRecipes={mealPlan.meal_plan_recipes}
                        isReplacing={replacingRecipeIds.has(mpr.recipe.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                {/* Mobile-only: Order from Instacart at top */}
                <div className="gg-card mb-4 lg:hidden">
                  <button
                    onClick={handleOrderInstacart}
                    disabled={isOrderingInstacart || (totalIngredients.items.length === 0 && movedSeasonings.size === 0) || (totalIngredients.items.every((item) => checkedItems.has(`item-${item.item}`)) && Array.from(movedSeasonings.values()).every(item => checkedItems.has(`moved-seasoning-${item.item}`)))}
                    className="w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-all duration-200 cursor-pointer hover:scale-[1.01] hover:shadow-lg active:scale-[0.98]"
                    style={{
                      height: '46px',
                      paddingTop: '16px',
                      paddingBottom: '16px',
                      paddingLeft: '18px',
                      paddingRight: '18px',
                      backgroundColor: '#003D29',
                      color: '#FAF1E5',
                    }}
                  >
                    {isOrderingInstacart ? (
                      <>
                        <svg className="animate-spin" style={{ width: '22px', height: '22px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating Order...
                      </>
                    ) : (
                      <>
                        <Image
                          src="/Instacart_Carrot.png"
                          alt="Instacart"
                          width={22}
                          height={22}
                          className="flex-shrink-0"
                        />
                        Get Recipe Ingredients
                      </>
                    )}
                  </button>
                  
                  {instacartError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{instacartError}</p>
                    </div>
                  )}
                  
                  <p className="mt-2 text-xs text-gray-500 text-center">
                    Opens in Instacart to complete your order
                  </p>
                </div>

                <div className="gg-card">
                  <h2 className="gg-heading-section mb-4">Shopping List</h2>
                  
                  {/* Description */}
                  <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs sm:text-sm text-gray-700 mb-2">
                      <strong>How it works:</strong> <span className="hidden sm:inline">Click anywhere on an item to check it off your list. Use the menu (⋮) to exclude ingredients from future meal plans or mark them as favorites.</span><span className="sm:hidden">Tap items to check off. Use ⋮ menu for more options.</span>
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">
                      Items are automatically consolidated from all recipes in your meal plan. Checked items are excluded when ordering from Instacart.
                    </p>
                  </div>
                  
                  {/* Main Items */}
                  {(totalIngredients.items.length > 0 || movedSeasonings.size > 0) ? (
                    <div className="space-y-2 mb-8">
                      {/* Regular items */}
                      {totalIngredients.items.map((item) => {
                        const itemId = `item-${item.item}`
                        return (
                          <div
                            key={itemId}
                            onClick={() => toggleItem(itemId)}
                            className={`flex items-center gap-2 sm:gap-4 rounded-lg border-2 p-3 sm:p-4 transition-all cursor-pointer ${
                              checkedItems.has(itemId)
                                ? 'border-gray-200 bg-gray-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <div
                              className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded border-2 transition-all flex-shrink-0 ${
                                checkedItems.has(itemId)
                                  ? 'border-[var(--gg-primary)] bg-[var(--gg-primary)]'
                                  : 'border-gray-300'
                              }`}
                            >
                              {checkedItems.has(itemId) && (
                                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            
                            <div className="flex-1">
                              <p className={`font-medium capitalize ${checkedItems.has(itemId) ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                {item.item}
                              </p>
                              {item.quantity && (
                                <p className="text-sm text-gray-500">
                                  {item.quantity}
                                </p>
                              )}
                            </div>

                            {/* Ingredient Actions Menu */}
                            <div onClick={(e) => e.stopPropagation()}>
                              <IngredientActions
                                itemId={itemId}
                                itemName={item.item}
                                onExclude={handleExcludeIngredient}
                                onFavor={handleFavorIngredient}
                              />
                            </div>
                          </div>
                        )
                      })}
                      {/* Moved seasonings */}
                      {Array.from(movedSeasonings.entries()).map(([seasoningId, item]) => {
                        const itemId = `moved-seasoning-${item.item}`
                        return (
                          <div
                            key={itemId}
                            onClick={() => toggleItem(itemId)}
                            className={`flex items-center gap-4 rounded-lg border-2 p-4 transition-all cursor-pointer ${
                              checkedItems.has(itemId)
                                ? 'border-gray-200 bg-gray-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <div
                              className={`flex h-6 w-6 items-center justify-center rounded border-2 transition-all flex-shrink-0 ${
                                checkedItems.has(itemId)
                                  ? 'border-[var(--gg-primary)] bg-[var(--gg-primary)]'
                                  : 'border-gray-300'
                              }`}
                            >
                              {checkedItems.has(itemId) && (
                                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            
                            <div className="flex-1">
                              <p className={`font-medium capitalize ${checkedItems.has(itemId) ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                {item.item}
                              </p>
                              {item.quantity && (
                                <p className="text-sm text-gray-500">
                                  {item.quantity}
                                </p>
                              )}
                            </div>

                            {/* Ingredient Actions Menu */}
                            <div onClick={(e) => e.stopPropagation()}>
                              <IngredientActions
                                itemId={itemId}
                                itemName={item.item}
                                onExclude={handleExcludeIngredient}
                                onFavor={handleFavorIngredient}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 mb-8">
                      <p className="gg-text-body text-gray-500">No items in shopping list.</p>
                    </div>
                  )}

                  {/* Seasonings Section */}
                  {totalIngredients.seasonings.length > 0 && (
                    <div className="border-t-2 border-gray-200 pt-6">
                      <h3 className="gg-heading-section mb-2 text-gray-600">Seasonings & Spices</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Click any seasoning below to add it to your shopping list. Once added, you can check it off like other items.
                      </p>
                      <div className="space-y-2">
                        {totalIngredients.seasonings
                          .map((item) => ({ item, seasoningId: `seasoning-${item.item}` }))
                          .filter(({ seasoningId }) => !movedSeasonings.has(seasoningId))
                          .map(({ item, seasoningId }) => {
                          const isChecked = checkedItems.has(`moved-seasoning-${item.item}`)
                          
                          return (
                            <div
                              key={seasoningId}
                              className="flex items-center gap-4 rounded-lg border-2 p-4 transition-all cursor-pointer border-gray-200 bg-gray-50 hover:border-gray-300"
                              onClick={() => {
                                // Move seasoning to items section
                                setMovedSeasonings(prev => {
                                  const newMap = new Map(prev)
                                  newMap.set(seasoningId, item)
                                  return newMap
                                })
                              }}
                            >
                              <div className="flex h-6 w-6 items-center justify-center">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </div>
                              
                              <div className="flex-1">
                                <p className="font-medium capitalize text-gray-600">
                                  {item.item}
                                </p>
                                {item.quantity && (
                                  <p className="text-sm text-gray-500">
                                    {item.quantity}
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Summary */}
              <div className="space-y-6">
                <div className="gg-card">
                  <h3 className="gg-heading-section mb-4">Shopping Summary</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="gg-text-body text-sm">Total Items</span>
                      <span className="text-2xl font-bold text-[var(--gg-primary)]">
                        {totalIngredients.items.length + movedSeasonings.size}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="gg-text-body text-sm">Checked Off</span>
                      <span className="text-2xl font-bold text-[var(--gg-primary)]">
                        {checkedItems.size}
                      </span>
                    </div>
                    {mealPlan.total_budget && (
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <span className="font-semibold text-gray-900">Est. Total</span>
                        <span className="text-2xl font-bold text-[var(--gg-primary)]">
                          ${mealPlan.total_budget.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Order from Instacart - Desktop only (mobile version is above shopping list) */}
                <div className="gg-card hidden lg:block">
                  <button
                    onClick={handleOrderInstacart}
                    disabled={isOrderingInstacart || (totalIngredients.items.length === 0 && movedSeasonings.size === 0) || (totalIngredients.items.every((item) => checkedItems.has(`item-${item.item}`)) && Array.from(movedSeasonings.values()).every(item => checkedItems.has(`moved-seasoning-${item.item}`)))}
                    className="w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-all duration-200 cursor-pointer hover:scale-[1.01] hover:shadow-lg active:scale-[0.98]"
                    style={{
                      height: '46px',
                      paddingTop: '16px',
                      paddingBottom: '16px',
                      paddingLeft: '18px',
                      paddingRight: '18px',
                      backgroundColor: '#003D29',
                      color: '#FAF1E5',
                    }}
                  >
                    {isOrderingInstacart ? (
                      <>
                        <svg className="animate-spin" style={{ width: '22px', height: '22px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating Order...
                      </>
                    ) : (
                      <>
                        <Image
                          src="/Instacart_Carrot.png"
                          alt="Instacart"
                          width={22}
                          height={22}
                          className="flex-shrink-0"
                        />
                        Get Recipe Ingredients
                      </>
                    )}
                  </button>
                  
                  {instacartError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{instacartError}</p>
                    </div>
                  )}
                  
                  <p className="mt-3 text-xs text-gray-500 text-center">
                    Your shopping list will open in Instacart where you can complete your order
                  </p>
                </div>

                {/* Copy to Clipboard */}
                <div className="gg-card">
                  <button
                    onClick={handleCopyToClipboard}
                    disabled={totalIngredients.items.length === 0 && movedSeasonings.size === 0}
                    className="w-full gg-btn-outline flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {copied ? (
                      <>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy to Clipboard
                      </>
                    )}
                  </button>
                  
                  <p className="mt-3 text-xs text-gray-500 text-center">
                    Copy your shopping list to paste anywhere
                  </p>
                </div>

                <div className="gg-card bg-blue-50 border-blue-200">
                  <div className="flex gap-3">
                    <svg className="h-6 w-6 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">
                        Shopping Tip
                      </p>
                      <p className="text-sm text-blue-800">
                        Check items off as you shop to keep track of what you&apos;ve picked up!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Recipe Modal */}
      {selectedRecipe && (
        <RecipeModal
          recipe={selectedRecipe}
          isOpen={!!selectedRecipe}
          onClose={() => {
            setSelectedRecipe(null)
            setSelectedRecipeSlots([])
            setClickedSlotDate(null)
          }}
          plannedSlots={plannedSlotSummaries}
          excludeDate={clickedSlotDate}
          onSaveCookingNote={handleSaveCookingNote}
          // onScaleServings={handleScaleServings} // COMMENTED OUT: Scale servings functionality
          // onSwapIngredient={handleSwapIngredient} // COMMENTED OUT: Swap ingredient functionality
          // onSimplifySteps={handleSimplifySteps} // COMMENTED OUT: Simplify recipe functionality
        />
      )}

      {/* COMMENTED OUT: Adjust Plan Panel - functionality hidden temporarily */}
      {/* <AdjustPlanPanel
        isOpen={isAdjustPanelOpen}
        onClose={() => setIsAdjustPanelOpen(false)}
        onApplyAdjustments={handleApplyAdjustments}
        appliedAdjustments={mealPlan.survey_snapshot?.applied_adjustments || []}
      /> */}

      {/* Action Error Toast */}
      {actionError && (
        <div className="fixed bottom-4 right-4 bg-red-50 border-2 border-red-500 rounded-lg p-4 shadow-lg z-50 max-w-md">
          <div className="flex items-start gap-3">
            <svg className="h-6 w-6 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900">Action Failed</p>
              <p className="text-sm text-red-800 mt-1">{actionError}</p>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Processing Overlay */}
      {isProcessing && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black opacity-40 z-50" />
          
          {/* Content */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl p-6 flex flex-col items-center gap-4 pointer-events-auto">
              <svg
                className="animate-spin h-12 w-12 text-[var(--gg-primary)]"
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
              <p className="text-gray-700 font-semibold">Updating your meal plan...</p>
            </div>
          </div>
        </>
      )}

      {/* Instacart Confirmation Modal */}
      {showInstacartModal && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black opacity-40 z-50" 
            onClick={() => setShowInstacartModal(false)}
          />
          
          {/* Modal Content */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full pointer-events-auto">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Beta Feature Notice</h3>
                  <p className="text-sm text-gray-700 mb-4">
                    Please double-check all item quantities and ingredients before ordering. This Instacart integration is currently in beta and may require manual adjustments.
                  </p>
                  <p className="text-sm text-gray-600">
                    Review your shopping list carefully to ensure accuracy before proceeding.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowInstacartModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={confirmOrderInstacart}
                  disabled={isOrderingInstacart}
                  className="px-4 py-2 text-sm font-medium text-white bg-[var(--gg-primary)] rounded-lg hover:bg-[var(--gg-primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isOrderingInstacart ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating Order...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Order from Instacart
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Replace Recipe Choice Modal */}
      <ReplaceRecipeChoiceModal
        isOpen={showReplaceChoiceModal}
        onClose={() => {
          setShowReplaceChoiceModal(false)
          setShowSavedRecipeSelector(false)
          // Reset replacing state for the recipe when modal closes
          if (replaceRecipeContext) {
            setReplacingRecipeIds(prev => {
              const newSet = new Set(prev)
              newSet.delete(replaceRecipeContext.recipeId)
              return newSet
            })
          }
          setReplaceRecipeContext(null)
        }}
        onGenerateNew={handleGenerateNewRecipe}
        onReplaceWithSaved={handleReplaceWithSavedRecipe}
      />

      {/* Saved Recipe Selector */}
      {replaceRecipeContext && (
        <SavedRecipeSelector
          isOpen={showSavedRecipeSelector}
          onClose={() => {
            setShowSavedRecipeSelector(false)
            setShowReplaceChoiceModal(false)
            // Reset replacing state for the recipe when modal closes
            setReplacingRecipeIds(prev => {
              const newSet = new Set(prev)
              newSet.delete(replaceRecipeContext.recipeId)
              return newSet
            })
            setReplaceRecipeContext(null)
          }}
          onSelect={handleSavedRecipeSelected}
          mealType={replaceRecipeContext.mealType as 'breakfast' | 'lunch' | 'dinner'}
          userId={mealPlan.user_id}
          excludeRecipeId={replaceRecipeContext.recipeId}
        />
      )}
    </div>
  )
}


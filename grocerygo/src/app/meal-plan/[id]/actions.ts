'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidateTag } from 'next/cache'
import { readAndParseMealPlanStream } from '@/utils/mealPlanStreamParser'
import type {
  GroceryItem,
  RecipeInsert,
  GroceryItemInsert,
  AIGeneratedMealPlan
} from '@/types/database'
import type { ShoppingListData, InstacartResponse, LineItem } from '@/types/instacart'
import { callOpenAI } from '@/app/actions/aiHelper'
import { trackMealPlanAction } from '@/app/actions/feedbackHelper'
import {
  replaceRecipePrompt,
  replaceRecipeWithTotalIngredientsPrompt,
  bulkAdjustmentPrompt,
  simplifyRecipePrompt
} from './prompts'
import { getDateForDayName } from '@/utils/mealPlanDates'
import {
  createMealPlanContext,
  getEmbedPrompts,
  fetchCandidateRecipesForMealType,
  fetchRecipeDetailsByIds
} from '@/services/mealPlanService'
import { getPostHogClient } from '@/lib/posthog-server';
import { logDatabaseError, logApiError, logAuthError, logUnexpectedError, logFetchError, logParseError, logValidationError } from '@/utils/errorLogger';

const INSTACART_API_URL = process.env.INSTACART_API_URL || 'https://connect.dev.instacart.tools/idp/v1/products/products_link'
const INSTACART_API_KEY = process.env.INSTACART_API_KEY

type AdditionalGroceryItem = {
  item: string
  quantity: string
}

type ReplacementRecipePayload = {
  recipe: {
    name: string
    ingredients: RecipeInsert['ingredients']
    steps: string[]
  }
  additional_grocery_items?: AdditionalGroceryItem[]
}

type RecipeIngredient = {
  item: string
  quantity: string
  unit?: string
  [key: string]: unknown
}

type SimplifiedRecipe = {
  name: string
  ingredients: RecipeInsert['ingredients']
  steps: string[]
}

export async function createInstacartOrder(
  mealPlanId: string,
  groceryItems: GroceryItem[],
  mealPlanTitle: string,
  mealPlanUrl: string
): Promise<{ success: boolean; link?: string; error?: string }> {
  try {
    if (!INSTACART_API_KEY) {
      throw new Error('Instacart API key is not configured')
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logAuthError('createInstacartOrder', authError || new Error('User not found'), {
        operation: 'getUser',
        authErrorType: authError ? 'auth_error' : 'user_not_found'
      })
      return { success: false, error: 'User not authenticated' }
    }

    // Convert grocery items to Instacart line items
    const lineItems: LineItem[] = groceryItems.map((item) => {
      const quantity = item.quantity || 1
      const unit = item.unit || 'count'
      
      return {
        name: item.item_name,
        quantity: quantity,
        unit: unit,
        display_text: `${quantity} ${unit} ${item.item_name}`,
        line_item_measurements: [
          {
            quantity: quantity,
            unit: unit
          }
        ],
        filters: {
          brand_filters: [],
          health_filters: []
        }
      }
    })

    // Create shopping list data
    const shoppingListData: ShoppingListData = {
      title: mealPlanTitle,
      link_type: 'shopping_list',
      expires_in: 1, // 1 day (Instacart expects days, not seconds)
      instructions: [
        'These ingredients are for your weekly meal plan from GroceryGo',
        'Feel free to adjust quantities based on your preferences'
      ],
      line_items: lineItems,
      landing_page_configuration: {
        partner_linkback_url: mealPlanUrl,
        enable_pantry_items: true
      }
    }

    // Make API call to Instacart
    const response = await fetch(INSTACART_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${INSTACART_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(shoppingListData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      logApiError('createInstacartOrder', new Error(`Instacart API returned ${response.status}: ${response.statusText}`), {
        endpoint: INSTACART_API_URL,
        method: 'POST',
        requestBody: { title: mealPlanTitle, itemCount: groceryItems.length },
        statusCode: response.status,
        responseBody: errorText
      }, user.id)
      throw new Error(`Instacart API returned ${response.status}: ${response.statusText}`)
    }

    const data: InstacartResponse = await response.json()
    
    // Save the link to the database
    const { error: updateError } = await supabase
      .from('meal_plans')
      .update({
        instacart_link: data.products_link_url,
        instacart_link_expires_at: data.expires_at || null
      })
      .eq('id', mealPlanId)
      .eq('user_id', user.id)

    if (updateError) {
      logDatabaseError('createInstacartOrder', updateError, {
        table: 'meal_plans',
        operation: 'UPDATE',
        queryParams: { id: mealPlanId, user_id: user.id }
      }, user.id)
      // Still return success with the link even if database update fails
      // The link is still valid and can be used
    }

    // Track Instacart order creation
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.id,
      event: 'instacart_order_created',
      properties: {
        meal_plan_id: mealPlanId,
        item_count: groceryItems.length,
        meal_plan_title: mealPlanTitle
      }
    });

    return {
      success: true,
      link: data.products_link_url
    }
  } catch (error) {
    logUnexpectedError('createInstacartOrder', error, {
      mealPlanId,
      groceryItemCount: groceryItems.length
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Instacart order'
    }
  }
}

/**
 * Update checked state for a shopping list item
 */
export async function updateShoppingListItemChecked(
  mealPlanId: string,
  itemName: string,
  checked: boolean,
  itemType: 'item' | 'seasoning'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logAuthError('updateShoppingListItemChecked', authError || new Error('User not found'), {
        operation: 'getUser',
        authErrorType: authError ? 'auth_error' : 'user_not_found'
      })
      return { success: false, error: 'User not authenticated' }
    }

    // Get current meal plan
    const { data: mealPlan, error: fetchError } = await supabase
      .from('meal_plans')
      .select('total_ingredients, user_id')
      .eq('id', mealPlanId)
      .single()

    if (fetchError || !mealPlan) {
      logDatabaseError('updateShoppingListItemChecked', fetchError || new Error('Meal plan not found'), {
        table: 'meal_plans',
        operation: 'SELECT',
        queryParams: { id: mealPlanId }
      }, user.id)
      return { success: false, error: 'Meal plan not found' }
    }

    if (mealPlan.user_id !== user.id) {
      logAuthError('updateShoppingListItemChecked', new Error('Unauthorized'), {
        operation: 'updateShoppingListItem',
        authErrorType: 'unauthorized'
      }, user.id)
      return { success: false, error: 'Unauthorized' }
    }

    // Handle backward compatibility: convert old array format to new structure
    let currentIngredients: {
      items: Array<{ item: string; quantity: string; checked?: boolean }>
      seasonings: Array<{ item: string; quantity: string; checked?: boolean }>
    }

    if (!mealPlan.total_ingredients) {
      currentIngredients = { items: [], seasonings: [] }
    } else if (Array.isArray(mealPlan.total_ingredients)) {
      // Old format: convert to new structure
      currentIngredients = {
        items: mealPlan.total_ingredients.map(item => ({ ...item, checked: false })),
        seasonings: []
      }
    } else if (typeof mealPlan.total_ingredients === 'object' && ('items' in mealPlan.total_ingredients || 'seasonings' in mealPlan.total_ingredients)) {
      // New format: use as-is
      currentIngredients = {
        items: (mealPlan.total_ingredients as any).items || [],
        seasonings: (mealPlan.total_ingredients as any).seasonings || []
      }
    } else {
      currentIngredients = { items: [], seasonings: [] }
    }

    // Normalize item name for comparison (case-insensitive)
    const normalizeName = (name: string) => name.toLowerCase().trim()
    const normalizedItemName = normalizeName(itemName)

    // If checking a seasoning, move it to items array first (since you can't check off in spices list)
    if (itemType === 'seasoning' && checked) {
      const seasoningIndex = currentIngredients.seasonings.findIndex(
        item => normalizeName(item.item) === normalizedItemName
      )

      if (seasoningIndex !== -1) {
        const seasoning = currentIngredients.seasonings[seasoningIndex]
        
        // Check if it already exists in items array
        const existingItemIndex = currentIngredients.items.findIndex(
          item => normalizeName(item.item) === normalizedItemName
        )

        if (existingItemIndex === -1) {
          // Move from seasonings to items
          currentIngredients.items.push({
            item: seasoning.item,
            quantity: seasoning.quantity,
            checked: true
          })
          currentIngredients.seasonings.splice(seasoningIndex, 1)
          
          // Sort items alphabetically
          currentIngredients.items.sort((a, b) => a.item.localeCompare(b.item))
        } else {
          // Already in items, just update checked state and remove from seasonings
          currentIngredients.items[existingItemIndex].checked = true
          currentIngredients.seasonings.splice(seasoningIndex, 1)
        }
      } else {
        // Seasoning not found in seasonings, check if it's in items
        const itemIndex = currentIngredients.items.findIndex(
          item => normalizeName(item.item) === normalizedItemName
        )
        if (itemIndex !== -1) {
          currentIngredients.items[itemIndex].checked = true
        } else {
          return { success: false, error: 'Item not found' }
        }
      }
    } else {
      // Update the checked state in the appropriate array
      const targetArray = itemType === 'item' ? currentIngredients.items : currentIngredients.seasonings
      const itemIndex = targetArray.findIndex(item => normalizeName(item.item) === normalizedItemName)

      if (itemIndex === -1) {
        return { success: false, error: 'Item not found' }
      }

      // Update the checked property
      targetArray[itemIndex] = {
        ...targetArray[itemIndex],
        checked: checked
      }
    }

    // Update the meal plan
    const { error: updateError } = await supabase
      .from('meal_plans')
      .update({ total_ingredients: currentIngredients })
      .eq('id', mealPlanId)
      .eq('user_id', user.id)

    if (updateError) {
      logDatabaseError('updateShoppingListItemChecked', updateError, {
        table: 'meal_plans',
        operation: 'UPDATE',
        queryParams: { id: mealPlanId, user_id: user.id, itemName, itemType, checked }
      }, user.id)
      return { success: false, error: 'Failed to update checked state' }
    }

    // Track shopping list item check
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.id,
      event: 'shopping_list_item_checked',
      properties: {
        meal_plan_id: mealPlanId,
        item_name: itemName,
        item_type: itemType,
        checked: checked
      }
    });

    // Revalidate cache
    revalidateTag('meal-plan')
    revalidateTag('dashboard')

    return { success: true }
  } catch (error) {
    logUnexpectedError('updateShoppingListItemChecked', error, {
      mealPlanId,
      itemName,
      itemType,
      checked
    })
    return {
      success: false,
      error: `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Move a seasoning from the seasonings array to the items array
 */
export async function moveSeasoningToItems(
  mealPlanId: string,
  seasoningName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    
    if (authError || !user) {
      logAuthError('moveSeasoningToItems', authError || new Error('User not found'), {
        operation: 'getUser',
        authErrorType: authError ? 'auth_error' : 'user_not_found'
      })
      return { success: false, error: 'User not authenticated' }
    }

    // Get current meal plan
    const { data: mealPlan, error: fetchError } = await supabase
      .from('meal_plans')
      .select('total_ingredients, user_id')
      .eq('id', mealPlanId)
      .single()

    if (fetchError || !mealPlan) {
      logDatabaseError('moveSeasoningToItems', fetchError || new Error('Meal plan not found'), {
        table: 'meal_plans',
        operation: 'SELECT',
        queryParams: { id: mealPlanId }
      }, user.id)
      return { success: false, error: 'Meal plan not found' }
    }

    if (mealPlan.user_id !== user.id) {
      logAuthError('moveSeasoningToItems', new Error('Unauthorized'), {
        operation: 'moveSeasoningToItems',
        authErrorType: 'unauthorized'
      }, user.id)
      return { success: false, error: 'Unauthorized' }
    }

    // Handle backward compatibility: convert old array format to new structure
    let currentIngredients: {
      items: Array<{ item: string; quantity: string; checked?: boolean }>
      seasonings: Array<{ item: string; quantity: string; checked?: boolean }>
    }

    if (!mealPlan.total_ingredients) {
      currentIngredients = { items: [], seasonings: [] }
    } else if (Array.isArray(mealPlan.total_ingredients)) {
      // Old format: convert to new structure
      currentIngredients = {
        items: mealPlan.total_ingredients.map(item => ({ ...item, checked: false })),
        seasonings: []
      }
    } else if (typeof mealPlan.total_ingredients === 'object' && ('items' in mealPlan.total_ingredients || 'seasonings' in mealPlan.total_ingredients)) {
      // New format: use as-is
      currentIngredients = {
        items: (mealPlan.total_ingredients as any).items || [],
        seasonings: (mealPlan.total_ingredients as any).seasonings || []
      }
    } else {
      currentIngredients = { items: [], seasonings: [] }
    }

    // Normalize item name for comparison (case-insensitive)
    const normalizeName = (name: string) => name.toLowerCase().trim()
    const normalizedSeasoningName = normalizeName(seasoningName)

    // Find the seasoning in the seasonings array
    const seasoningIndex = currentIngredients.seasonings.findIndex(
      item => normalizeName(item.item) === normalizedSeasoningName
    )

    if (seasoningIndex === -1) {
      return { success: false, error: 'Seasoning not found' }
    }

    const seasoning = currentIngredients.seasonings[seasoningIndex]

    // Check if it already exists in items array (shouldn't happen, but handle it)
    const existingItemIndex = currentIngredients.items.findIndex(
      item => normalizeName(item.item) === normalizedSeasoningName
    )

    if (existingItemIndex !== -1) {
      // Already in items, just remove from seasonings
      currentIngredients.seasonings.splice(seasoningIndex, 1)
    } else {
      // Move from seasonings to items
      currentIngredients.items.push({
        item: seasoning.item,
        quantity: seasoning.quantity,
        checked: seasoning.checked || false
      })
      currentIngredients.seasonings.splice(seasoningIndex, 1)
      
      // Sort items alphabetically
      currentIngredients.items.sort((a, b) => a.item.localeCompare(b.item))
    }

    // Update the meal plan
    const { error: updateError } = await supabase
      .from('meal_plans')
      .update({ total_ingredients: currentIngredients })
      .eq('id', mealPlanId)
      .eq('user_id', user.id)

    if (updateError) {
      logDatabaseError('moveSeasoningToItems', updateError, {
        table: 'meal_plans',
        operation: 'UPDATE',
        queryParams: { id: mealPlanId, user_id: user.id, seasoningName }
      }, user.id)
      return { success: false, error: 'Failed to move seasoning' }
    }

    // Revalidate cache
    revalidateTag('meal-plan')
    revalidateTag('dashboard')

    return { success: true }
  } catch (error) {
    logUnexpectedError('moveSeasoningToItems', error, {
      mealPlanId,
      seasoningName
    })
    return {
      success: false,
      error: `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Helper function to generate a single meal replacement using the meal plan generation API
 */
async function generateSingleMealReplacement(
  mealPlanId: string,
  mealType: 'breakfast' | 'lunch' | 'dinner'
): Promise<{ success: boolean; error?: string; recipe?: { name: string; ingredients: RecipeInsert['ingredients']; steps: string[]; mealType: string } }> {
  try {
    console.log('[generateSingleMealReplacement] Starting generation', { mealPlanId, mealType })
    // Prepare meal selection with 1 for the target meal type
    const mealSelection = {
      breakfast: mealType === 'breakfast' ? 1 : 0,
      lunch: mealType === 'lunch' ? 1 : 0,
      dinner: mealType === 'dinner' ? 1 : 0
    }

    // Prepare distinct recipe counts
    const distinctRecipeCounts = {
      breakfast: mealType === 'breakfast' ? 1 : 0,
      lunch: mealType === 'lunch' ? 1 : 0,
      dinner: mealType === 'dinner' ? 1 : 0
    }

    // Prepare selected slots (day doesn't matter since we're generating one recipe)
    const selectedSlots = [{ day: 'Monday', mealType }]

    // Call the meal plan generation API
    // Use relative URL - Next.js automatically handles this in server-side fetch
    const response = await fetch('/api/generate-meal-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mealSelection,
        mealPlanId,
        distinctRecipeCounts,
        selectedSlots
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      logFetchError('generateSingleMealReplacement', new Error(`API error: ${response.status}`), {
        url: '/api/generate-meal-plan',
        method: 'POST',
        requestBody: { mealSelection, mealPlanId, distinctRecipeCounts, selectedSlots },
        status: response.status,
        responseText: errorText
      })
      return { success: false, error: `API error: ${response.status} ${errorText}` }
    }
    console.log('[generateSingleMealReplacement] API response OK, parsing stream...')

    // Read and parse the streamed response using utility function
    const parsedResponse = await readAndParseMealPlanStream(response)
    
    if (!parsedResponse) {
      logParseError('generateSingleMealReplacement', new Error('Failed to parse API response'), {
        dataType: 'meal plan stream'
      })
      return { success: false, error: 'Failed to parse API response' }
    }
    console.log('[generateSingleMealReplacement] Parsed response:', {
      recipeCount: parsedResponse.recipes.length
    })

    // Extract the recipe (should be exactly one)
    if (parsedResponse.recipes.length === 0) {
      logValidationError('generateSingleMealReplacement', new Error('No recipes in parsed response'), {
        validationType: 'recipe_count',
        reason: 'Expected at least 1 recipe but got 0'
      })
      return { success: false, error: 'No recipe generated' }
    }

    // Use the first recipe (should be the only one)
    const generatedRecipe = parsedResponse.recipes[0]
    console.log('[generateSingleMealReplacement] Recipe generated:', generatedRecipe.name)

    return {
      success: true,
      recipe: {
        name: generatedRecipe.name,
        ingredients: generatedRecipe.ingredients,
        steps: generatedRecipe.steps,
        mealType: generatedRecipe.mealType || mealType
      }
    }
  } catch (error) {
    logUnexpectedError('generateSingleMealReplacement', error, {
      mealPlanId,
      mealType
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate meal replacement'
    }
  }
}

/**
 * Feature 1: Replace individual recipe
 * Replaces ALL occurrences of a recipe with a single new recipe generated using the meal plan generation API
 */
export async function replaceRecipe(
  mealPlanId: string,
  recipeId: string,
  mealType: string
): Promise<{ success: boolean; error?: string; newRecipeId?: string }> {
  try {
    console.log('[replaceRecipe] Starting replacement', { mealPlanId, recipeId, mealType })
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logAuthError('replaceRecipe', authError || new Error('User not found'), {
        operation: 'getUser',
        authErrorType: authError ? 'auth_error' : 'user_not_found'
      })
      return { success: false, error: 'User not authenticated' }
    }
    console.log('[replaceRecipe] User authenticated:', user.id)

    // Get meal plan with survey snapshot and total_ingredients
    const { data: mealPlan, error: mealPlanError } = await supabase
      .from('meal_plans')
      .select('*, meal_plan_recipes(*, recipe:full_recipes_table(*))')
      .eq('id', mealPlanId)
      .eq('user_id', user.id)
      .single()

    if (mealPlanError) {
      logDatabaseError('replaceRecipe', mealPlanError, {
        table: 'meal_plans',
        operation: 'SELECT',
        queryParams: { id: mealPlanId, user_id: user.id }
      }, user.id)
      return { success: false, error: `Meal plan fetch error: ${mealPlanError.message}` }
    }
    if (!mealPlan) {
      logDatabaseError('replaceRecipe', new Error('Meal plan not found'), {
        table: 'meal_plans',
        operation: 'SELECT',
        queryParams: { id: mealPlanId, user_id: user.id }
      }, user.id)
      return { success: false, error: 'Meal plan not found' }
    }
    console.log('[replaceRecipe] Meal plan found:', mealPlan.id, 'with', mealPlan.meal_plan_recipes?.length || 0, 'recipes')

    // Find ALL meal_plan_recipes that use this recipe_id (either as recipe_id or updated_recipe_id)
    const mealPlanRecipesToReplace = mealPlan.meal_plan_recipes.filter(
      (mpr: any) => String(mpr.recipe_id) === String(recipeId) || String(mpr.updated_recipe_id) === String(recipeId)
    )

    console.log('[replaceRecipe] Found', mealPlanRecipesToReplace.length, 'meal plan recipes to replace')
    if (mealPlanRecipesToReplace.length === 0) {
      logValidationError('replaceRecipe', new Error('No meal plan recipes found'), {
        validationType: 'recipe_existence',
        field: 'recipeId',
        input: recipeId,
        reason: 'No meal_plan_recipes found matching recipe_id'
      }, user.id)
      return { success: false, error: 'No meal plan recipes found with this recipe' }
    }

    // Get the recipe being replaced - check both recipes table and full_recipes_table
    let oldRecipe: any = null
    
    // First check recipes table (updated_recipe_id)
    const { data: recipeFromRecipes, error: recipesError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single()
    
    if (recipesError) {
      console.log('[replaceRecipe] Recipe not found in recipes table, checking full_recipes_table:', recipesError.message)
    }
    
    if (recipeFromRecipes) {
      oldRecipe = recipeFromRecipes
      console.log('[replaceRecipe] Found old recipe in recipes table:', recipeFromRecipes.name)
    } else {
      // Fallback to full_recipes_table (parent recipe)
      const { data: recipeFromFull, error: fullRecipesError } = await supabase
        .from('full_recipes_table')
        .select('*')
        .eq('recipe_id', recipeId)
        .single()
      
      if (fullRecipesError) {
        logDatabaseError('replaceRecipe', fullRecipesError, {
          table: 'full_recipes_table',
          operation: 'SELECT',
          queryParams: { recipe_id: recipeId }
        }, user.id)
      }
      
      if (recipeFromFull) {
        oldRecipe = recipeFromFull
        console.log('[replaceRecipe] Found old recipe in full_recipes_table:', recipeFromFull.name)
      }
    }

    if (!oldRecipe) {
      logDatabaseError('replaceRecipe', new Error('Recipe not found in either table'), {
        table: 'recipes/full_recipes_table',
        operation: 'SELECT',
        queryParams: { recipeId }
      }, user.id)
      return { success: false, error: 'Recipe not found' }
    }

    // Determine meal type: use parameter if provided, otherwise from first occurrence, or default to 'dinner'
    const targetMealType = (mealType || mealPlanRecipesToReplace[0]?.meal_type || 'dinner').toLowerCase() as 'breakfast' | 'lunch' | 'dinner'
    console.log('[replaceRecipe] Target meal type:', targetMealType)

    // Get current total_ingredients from meal plan (handle both old and new formats)
    let currentTotalIngredients: { items: Array<{ item: string; quantity: string; checked?: boolean }>; seasonings: Array<{ item: string; quantity: string; checked?: boolean }> }
    if (Array.isArray(mealPlan.total_ingredients)) {
      // Old format: convert to new structure
      currentTotalIngredients = {
        items: mealPlan.total_ingredients,
        seasonings: []
      }
    } else if (mealPlan.total_ingredients && typeof mealPlan.total_ingredients === 'object' && ('items' in mealPlan.total_ingredients || 'seasonings' in mealPlan.total_ingredients)) {
      // New format: use as-is
      currentTotalIngredients = {
        items: (mealPlan.total_ingredients as any).items || [],
        seasonings: (mealPlan.total_ingredients as any).seasonings || []
      }
    } else {
      // No total_ingredients: use empty structure
      currentTotalIngredients = { items: [], seasonings: [] }
    }
    console.log('[replaceRecipe] Current total_ingredients - items:', currentTotalIngredients.items.length, 'seasonings:', currentTotalIngredients.seasonings.length)

    // Get old recipe ingredients
    const oldRecipeIngredients = (oldRecipe.ingredients || []) as Array<{ item: string; quantity: string }>
    console.log('[replaceRecipe] Old recipe has', oldRecipeIngredients.length, 'ingredients')

    // Get survey data for embedding and prompt
    const surveyData = mealPlan.survey_snapshot || {}
    if (!surveyData || Object.keys(surveyData).length === 0) {
      logValidationError('replaceRecipe', new Error('No survey snapshot found'), {
        validationType: 'survey_data',
        field: 'survey_snapshot',
        reason: 'Meal plan missing survey data'
      }, user.id)
      return { success: false, error: 'Meal plan missing survey data' }
    }

    // Reuse embedding and recipe fetching logic
    console.log('[replaceRecipe] Creating meal plan context and fetching candidate recipe...')
    const context = await createMealPlanContext()
    
    // Generate unique embedding prompt for replacement (1 for target meal type, 0 for others)
    const embedPrompts = await getEmbedPrompts(surveyData, {
      breakfast: targetMealType === 'breakfast' ? 1 : 0,
      lunch: targetMealType === 'lunch' ? 1 : 0,
      dinner: targetMealType === 'dinner' ? 1 : 0
    }, {
      name: oldRecipe.name,
      ingredients: oldRecipeIngredients
    }) as { breakfast: string[]; lunch: string[]; dinner: string[] }
    
    // Get embedding prompt for the target meal type
    const mealTypeEmbedPrompt = targetMealType === 'breakfast' 
      ? embedPrompts.breakfast[0]
      : targetMealType === 'lunch'
      ? embedPrompts.lunch[0]
      : embedPrompts.dinner[0]

    if (!mealTypeEmbedPrompt) {
      logValidationError('replaceRecipe', new Error('No embedding prompt generated'), {
        validationType: 'embedding_prompt',
        field: 'mealType',
        input: targetMealType,
        reason: 'Failed to generate embedding prompt for replacement'
      }, user.id)
      return { success: false, error: 'Failed to generate embedding prompt for replacement' }
    }

    // Fetch candidate recipe
    const candidateIds = await fetchCandidateRecipesForMealType(
      mealTypeEmbedPrompt,
      context,
      targetMealType === 'breakfast' ? 'breakfast' : 'lunch/dinner',
      1
    )

    if (candidateIds.length === 0) {
      logValidationError('replaceRecipe', new Error('No candidate recipes found'), {
        validationType: 'candidate_recipes',
        reason: 'No candidate recipes found for replacement'
      }, user.id)
      return { success: false, error: 'No candidate recipes found for replacement' }
    }

    // Fetch recipe details
    const candidateRecipes = await fetchRecipeDetailsByIds(context, candidateIds)
    if (candidateRecipes.length === 0) {
      logValidationError('replaceRecipe', new Error('No recipe details found'), {
        validationType: 'recipe_details',
        reason: 'Failed to fetch recipe details'
      }, user.id)
      return { success: false, error: 'Failed to fetch recipe details' }
    }

    const candidateRecipe = candidateRecipes[0]
    console.log('[replaceRecipe] Using candidate recipe:', candidateRecipe.name)

    // Generate replacement recipe with total_ingredients update using new prompt
    console.log('[replaceRecipe] Generating replacement recipe with total_ingredients update...')
    const prompt = replaceRecipeWithTotalIngredientsPrompt(
      surveyData as any,
      targetMealType,
      oldRecipe.name,
      oldRecipeIngredients,
      currentTotalIngredients,
      candidateRecipe
    )

    const systemPrompt = `You are an expert meal planning assistant for GroceryGo.
You must generate replacement recipes that align with user goals and accurately update the total ingredients list.
CRITICAL: When updating total_ingredients, you MUST:
- Remove ingredients from the old recipe (subtract quantities)
- Add ingredients from the new recipe (add quantities)
- Consolidate ingredients with matching names and units
- Use consistent ingredient names
- Return valid JSON only.`

    const aiResult = await callOpenAI<{ recipe: { name: string; ingredients: Array<{ item: string; quantity: string }>; steps: string[] }; updated_total_ingredients: { items: Array<{ item: string; quantity: string }>; seasonings: Array<{ item: string; quantity: string }> } }>(
      systemPrompt,
      prompt,
      (response: string) => {
        console.log('[replaceRecipe] Parsing AI response, length:', response.length)
        console.log('[replaceRecipe] Response preview:', response.substring(0, 500))
        
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          logParseError('replaceRecipe', new Error('No JSON found in response'), {
            dataType: 'AI response',
            rawData: response.substring(0, 500)
          }, user.id)
          throw new Error('No JSON found in response')
        }
        
        let parsed: any
        try {
          parsed = JSON.parse(jsonMatch[0])
          console.log('[replaceRecipe] JSON parsed successfully. Keys:', Object.keys(parsed))
        } catch (parseError) {
          logParseError('replaceRecipe', parseError as Error, {
            dataType: 'JSON',
            rawData: jsonMatch[0].substring(0, 500)
          }, user.id)
          throw new Error(`Failed to parse JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
        }
        
        if (!parsed.recipe) {
          logValidationError('replaceRecipe', new Error('Missing recipe field'), {
            validationType: 'required_field',
            field: 'recipe',
            input: Object.keys(parsed),
            reason: 'Missing required field: recipe'
          }, user.id)
          throw new Error('Missing required field: recipe')
        }
        
        if (!parsed.updated_total_ingredients) {
          logValidationError('replaceRecipe', new Error('Missing updated_total_ingredients field'), {
            validationType: 'required_field',
            field: 'updated_total_ingredients',
            input: Object.keys(parsed),
            reason: 'Missing required field: updated_total_ingredients'
          }, user.id)
          throw new Error('Missing required field: updated_total_ingredients')
        }

        console.log('[replaceRecipe] Recipe structure:', {
          hasName: !!parsed.recipe.name,
          hasIngredients: !!parsed.recipe.ingredients,
          ingredientsIsArray: Array.isArray(parsed.recipe.ingredients),
          hasSteps: !!parsed.recipe.steps,
          stepsIsArray: Array.isArray(parsed.recipe.steps),
          updatedTotalIngredientsType: typeof parsed.updated_total_ingredients,
          updatedTotalIngredientsIsArray: Array.isArray(parsed.updated_total_ingredients),
          updatedTotalIngredientsKeys: typeof parsed.updated_total_ingredients === 'object' && parsed.updated_total_ingredients !== null ? Object.keys(parsed.updated_total_ingredients) : null
        })

        // Handle both old array format and new nested structure from AI
        let updatedTotalIngredients: { items: Array<{ item: string; quantity: string }>; seasonings: Array<{ item: string; quantity: string }> }
        if (Array.isArray(parsed.updated_total_ingredients)) {
          // Old format: convert to new structure
          console.log('[replaceRecipe] Detected old array format for updated_total_ingredients, converting')
          updatedTotalIngredients = {
            items: parsed.updated_total_ingredients,
            seasonings: []
          }
        } else if (parsed.updated_total_ingredients.items || parsed.updated_total_ingredients.seasonings) {
          // New format: use as-is
          console.log('[replaceRecipe] Detected new object format for updated_total_ingredients')
          updatedTotalIngredients = {
            items: parsed.updated_total_ingredients.items || [],
            seasonings: parsed.updated_total_ingredients.seasonings || []
          }
        } else {
          logValidationError('replaceRecipe', new Error('Invalid updated_total_ingredients format'), {
            validationType: 'data_format',
            field: 'updated_total_ingredients',
            input: {
              type: typeof parsed.updated_total_ingredients,
              isArray: Array.isArray(parsed.updated_total_ingredients),
              keys: typeof parsed.updated_total_ingredients === 'object' && parsed.updated_total_ingredients !== null ? Object.keys(parsed.updated_total_ingredients) : null
            },
            reason: 'Invalid updated_total_ingredients format'
          }, user.id)
          throw new Error('Invalid updated_total_ingredients format')
        }

        console.log('[replaceRecipe] Successfully parsed and transformed data:', {
          recipeName: parsed.recipe.name,
          ingredientsCount: updatedTotalIngredients.items.length,
          seasoningsCount: updatedTotalIngredients.seasonings.length
        })

        return {
          recipe: parsed.recipe,
          updated_total_ingredients: updatedTotalIngredients
        }
      },
      (data) => {
        // Basic validation with detailed logging
        const hasRecipe = !!data.recipe
        const hasRecipeName = !!(data.recipe && data.recipe.name)
        const hasIngredientsArray = !!(data.recipe && Array.isArray(data.recipe.ingredients))
        const hasStepsArray = !!(data.recipe && Array.isArray(data.recipe.steps))
        const hasUpdatedTotalIngredients = !!data.updated_total_ingredients
        const isUpdatedTotalIngredientsObject = !!(data.updated_total_ingredients && typeof data.updated_total_ingredients === 'object' && !Array.isArray(data.updated_total_ingredients))
        const hasItemsArray = !!(data.updated_total_ingredients && typeof data.updated_total_ingredients === 'object' && Array.isArray(data.updated_total_ingredients.items))
        const hasSeasoningsArray = !!(data.updated_total_ingredients && typeof data.updated_total_ingredients === 'object' && Array.isArray(data.updated_total_ingredients.seasonings))
        
        const validationPassed = !!(
          hasRecipe &&
          hasRecipeName &&
          hasIngredientsArray &&
          hasStepsArray &&
          hasUpdatedTotalIngredients &&
          isUpdatedTotalIngredientsObject &&
          hasItemsArray &&
          hasSeasoningsArray
        )
        
        if (!validationPassed) {
          logValidationError('replaceRecipe', new Error('AI response validation failed'), {
            validationType: 'ai_response_structure',
            input: {
              hasRecipe,
              hasRecipeName,
              hasIngredientsArray,
              hasStepsArray,
              hasUpdatedTotalIngredients,
              isUpdatedTotalIngredientsObject,
              hasItemsArray,
              hasSeasoningsArray
            },
            reason: 'AI response failed structure validation'
          }, user.id)
        }
        
        return validationPassed
      }
    )

    if (!aiResult.success || !aiResult.data) {
      logApiError('replaceRecipe', new Error(aiResult.error || 'AI generation failed'), {
        endpoint: 'OpenAI API',
        method: 'POST',
        requestBody: { mealPlanId, recipeId, mealType: targetMealType },
        responseBody: aiResult.rawResponse?.substring(0, 500)
      }, user.id)
      return { success: false, error: aiResult.error || 'Failed to generate replacement recipe' }
    }

    const { recipe: newRecipeData, updated_total_ingredients } = aiResult.data
    console.log('[replaceRecipe] Recipe generated successfully:', newRecipeData.name)
    console.log('[replaceRecipe] Updated total_ingredients - items:', updated_total_ingredients.items.length, 'seasonings:', updated_total_ingredients.seasonings.length)

    // Create new recipe in recipes table (not full_recipes_table)
    // Map ingredients to the correct format
    const recipeInsert: RecipeInsert = {
      name: newRecipeData.name,
      ingredients: newRecipeData.ingredients.map(ing => ({
        item: ing.item,
        quantity: ing.quantity,
        unit: ing.quantity.split(/\s+/).slice(1).join(' ') || undefined
      })),
      steps: newRecipeData.steps,
      meal_type: targetMealType,
      servings: 1 // Default servings, will be updated based on usage
    }
    
    console.log('[replaceRecipe] Recipe insert data prepared:', {
      name: recipeInsert.name,
      ingredientCount: recipeInsert.ingredients.length,
      stepCount: recipeInsert.steps.length
    })

    console.log('[replaceRecipe] Inserting new recipe into recipes table...')
    const { data: newRecipe, error: recipeError } = await supabase
      .from('recipes')
      .insert(recipeInsert)
      .select('id')
      .single()

    if (recipeError) {
      logDatabaseError('replaceRecipe', recipeError, {
        table: 'recipes',
        operation: 'INSERT',
        queryParams: { name: recipeInsert.name, meal_type: targetMealType }
      }, user.id)
      return { success: false, error: `Failed to create new recipe: ${recipeError.message}` }
    }
    if (!newRecipe) {
      logDatabaseError('replaceRecipe', new Error('Recipe insert returned no data'), {
        table: 'recipes',
        operation: 'INSERT',
        queryParams: { name: recipeInsert.name }
      }, user.id)
      return { success: false, error: 'Failed to create new recipe: No data returned' }
    }
    console.log('[replaceRecipe] New recipe created:', newRecipe.id)

    // Update ALL meal_plan_recipes that use the old recipe
    // recipe_id is an integer (references full_recipes_table)
    // updated_recipe_id is a UUID (references recipes table)
    // Check if recipeId is a UUID or integer to determine which field to match
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recipeId)
    const isInteger = /^\d+$/.test(recipeId)
    
    console.log('[replaceRecipe] Recipe ID type check:', { recipeId, isUUID, isInteger })
    
    let totalUpdated = 0
    let updateError: any = null
    
    if (isUUID) {
      // Recipe ID is a UUID, so it's from the recipes table (updated_recipe_id)
      console.log('[replaceRecipe] Updating meal_plan_recipes with updated_recipe_id:', recipeId)
      const { data: updated, error: error } = await supabase
        .from('meal_plan_recipes')
        .update({ updated_recipe_id: newRecipe.id })
        .eq('meal_plan_id', mealPlanId)
        .eq('updated_recipe_id', recipeId)
        .select('id')
      
      totalUpdated = updated?.length || 0
      updateError = error
      console.log('[replaceRecipe] Updated', totalUpdated, 'records with updated_recipe_id match')
    } else if (isInteger) {
      // Recipe ID is an integer, so it's from full_recipes_table (recipe_id)
      console.log('[replaceRecipe] Updating meal_plan_recipes with recipe_id:', recipeId)
      const { data: updated, error: error } = await supabase
        .from('meal_plan_recipes')
        .update({ updated_recipe_id: newRecipe.id })
        .eq('meal_plan_id', mealPlanId)
        .eq('recipe_id', parseInt(recipeId, 10))
        .select('id')
      
      totalUpdated = updated?.length || 0
      updateError = error
      console.log('[replaceRecipe] Updated', totalUpdated, 'records with recipe_id match')
    } else {
      // Try both - might be a string representation of an integer
      console.log('[replaceRecipe] Recipe ID format unclear, trying both update methods')
      
      // Try as UUID first (updated_recipe_id)
      const { data: updated1, error: error1 } = await supabase
        .from('meal_plan_recipes')
        .update({ updated_recipe_id: newRecipe.id })
        .eq('meal_plan_id', mealPlanId)
        .eq('updated_recipe_id', recipeId)
        .select('id')
      
      // Try as integer (recipe_id) - only if first didn't work
      let updated2: any[] = []
      let error2: any = null
      if (!updated1 || updated1.length === 0) {
        const parsedInt = parseInt(recipeId, 10)
        if (!isNaN(parsedInt)) {
          const result = await supabase
            .from('meal_plan_recipes')
            .update({ updated_recipe_id: newRecipe.id })
            .eq('meal_plan_id', mealPlanId)
            .eq('recipe_id', parsedInt)
            .select('id')
          updated2 = result.data || []
          error2 = result.error
        }
      }
      
      totalUpdated = (updated1?.length || 0) + (updated2?.length || 0)
      updateError = error1 || error2
      console.log('[replaceRecipe] Updated', totalUpdated, 'records total (tried both methods)')
    }
    
    if (updateError) {
      logDatabaseError('replaceRecipe', updateError, {
        table: 'meal_plan_recipes',
        operation: 'UPDATE',
        queryParams: { meal_plan_id: mealPlanId, recipeId, newRecipeId: newRecipe.id }
      }, user.id)
      return { success: false, error: `Failed to update meal plan recipes: ${updateError.message}` }
    }
    
    if (totalUpdated === 0) {
      logValidationError('replaceRecipe', new Error('No records were updated'), {
        validationType: 'update_count',
        reason: 'No meal plan recipes were updated'
      }, user.id)
      return { success: false, error: 'No meal plan recipes were updated' }
    }
    
    console.log('[replaceRecipe] Successfully updated', totalUpdated, 'meal_plan_recipes')

    // Preserve checked state from current total_ingredients
    console.log('[replaceRecipe] Preserving checked state from current total_ingredients...')
    const normalizeName = (name: string) => name.toLowerCase().trim()
    
    // Get current checked state
    const currentCheckedState = new Map<string, boolean>()
    if (currentTotalIngredients.items) {
      currentTotalIngredients.items.forEach(item => {
        if (item.checked !== undefined) {
          currentCheckedState.set(normalizeName(item.item), item.checked)
        }
      })
    }
    if (currentTotalIngredients.seasonings) {
      currentTotalIngredients.seasonings.forEach(item => {
        if (item.checked !== undefined) {
          currentCheckedState.set(normalizeName(item.item), item.checked)
        }
      })
    }
    
    // Apply checked state to updated ingredients
    const updatedWithCheckedState = {
      items: updated_total_ingredients.items.map(item => ({
        ...item,
        checked: currentCheckedState.get(normalizeName(item.item)) ?? false
      })),
      seasonings: updated_total_ingredients.seasonings.map(item => ({
        ...item,
        checked: currentCheckedState.get(normalizeName(item.item)) ?? false
      }))
    }

    // Update meal plan's total_ingredients
    console.log('[replaceRecipe] Updating meal plan total_ingredients...')
    const { error: totalIngredientsError } = await supabase
      .from('meal_plans')
      .update({ total_ingredients: updatedWithCheckedState })
      .eq('id', mealPlanId)

    if (totalIngredientsError) {
      logDatabaseError('replaceRecipe', totalIngredientsError, {
        table: 'meal_plans',
        operation: 'UPDATE',
        queryParams: { id: mealPlanId, user_id: user.id }
      }, user.id)
      // Don't fail the whole operation, but log the error
    } else {
      console.log('[replaceRecipe] Total ingredients updated successfully')
    }

    // Track action
    console.log('[replaceRecipe] Tracking action...')
    try {
      await trackMealPlanAction(
        mealPlanId,
        user.id,
        `User replaced recipe '${oldRecipe.name}' with a new ${targetMealType} recipe (${mealPlanRecipesToReplace.length} occurrence${mealPlanRecipesToReplace.length === 1 ? '' : 's'})`
      )
      console.log('[replaceRecipe] Action tracked successfully')
    } catch (trackError) {
      console.warn('[replaceRecipe] Failed to track action:', trackError)
      // Don't fail the whole operation if tracking fails
    }

    // Track recipe replacement
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.id,
      event: 'recipe_replaced',
      properties: {
        meal_plan_id: mealPlanId,
        old_recipe_id: recipeId,
        old_recipe_name: oldRecipe.name,
        new_recipe_id: newRecipe.id,
        new_recipe_name: newRecipeData.name,
        meal_type: targetMealType,
        occurrences_replaced: totalUpdated
      }
    });

    console.log('[replaceRecipe] Revalidating cache...')
    revalidateTag('meal-plan')
    revalidateTag('dashboard')

    console.log('[replaceRecipe] Replacement completed successfully. New recipe ID:', newRecipe.id)
    return { success: true, newRecipeId: newRecipe.id }
  } catch (error) {
    logUnexpectedError('replaceRecipe', error, {
      mealPlanId,
      recipeId,
      mealType
    })
    return {
      success: false,
      error: `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Feature 2: Regenerate with bulk adjustments
 */
export async function regenerateWithAdjustments(
  mealPlanId: string,
  adjustments: {
    reduceTime?: boolean
    lowerBudget?: boolean
    minimizeIngredients?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Get meal plan
    const { data: mealPlan } = await supabase
      .from('meal_plans')
      .select('*, meal_plan_recipes(*)')
      .eq('id', mealPlanId)
      .eq('user_id', user.id)
      .single()

    if (!mealPlan) {
      return { success: false, error: 'Meal plan not found' }
    }

    // Calculate meal breakdown
    const totalMeals = mealPlan.total_meals
    const mealBreakdown = {
      breakfast: Math.floor(totalMeals / 3),
      lunch: Math.floor(totalMeals / 3),
      dinner: totalMeals - (2 * Math.floor(totalMeals / 3))
    }

    // Generate prompt with adjustments
    const prompt = bulkAdjustmentPrompt(
      mealPlan.survey_snapshot || {},
      adjustments,
      totalMeals,
      mealBreakdown
    )

    const result = await callOpenAI<AIGeneratedMealPlan>(
      'You are an expert meal planner for GroceryGo. Generate a complete meal plan with optimizations in JSON format.',
      prompt,
      (response) => {
        const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) || response.match(/```\n?([\s\S]*?)\n?```/)
        const jsonStr = jsonMatch ? jsonMatch[1] : response
        return JSON.parse(jsonStr)
      }
    )

    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to generate meal plan' }
    }

    const aiMealPlan = result.data

    // Delete existing recipes and grocery items
    await supabase
      .from('meal_plan_recipes')
      .delete()
      .eq('meal_plan_id', mealPlanId)

    await supabase
      .from('grocery_items')
      .delete()
      .eq('meal_plan_id', mealPlanId)

    // Create new recipes
    const recipeIds: string[] = []
    const recipeIdMap: Record<string, string> = {}
    for (const aiRecipe of aiMealPlan.recipes) {
      const { data: newRecipe } = await supabase
        .from('full_recipes_table')
        .insert({
          name: aiRecipe.name,
          ingredients: aiRecipe.ingredients,
          steps: aiRecipe.steps,
          meal_type: aiRecipe.mealType ? aiRecipe.mealType : null,
          times_used: 1
        } as RecipeInsert)
        .select()
        .single()

      if (newRecipe) {
        recipeIds.push(newRecipe.id)
        if (aiRecipe.id) {
          recipeIdMap[aiRecipe.id] = newRecipe.id
        }
      }
    }

    const scheduleEntries = aiMealPlan.schedule && Array.isArray(aiMealPlan.schedule)
      ? aiMealPlan.schedule
      : []

    const mealPlanRecipes = scheduleEntries.length > 0
      ? scheduleEntries.reduce<{
          inserts: {
            meal_plan_id: string
            recipe_id: string
            planned_for_date?: string
            meal_type?: 'breakfast' | 'lunch' | 'dinner'
            portion_multiplier?: number
            slot_label?: string
          }[]
          missingRecipeRefs: string[]
        }>((acc, entry) => {
          const linkedRecipeId = recipeIdMap[entry.recipeId]
          if (!linkedRecipeId) {
            acc.missingRecipeRefs.push(entry.recipeId)
            return acc
          }

          const mealType = entry.mealType?.toLowerCase() as 'breakfast' | 'lunch' | 'dinner' | undefined
          acc.inserts.push({
            meal_plan_id: mealPlanId,
            recipe_id: linkedRecipeId,
            planned_for_date: getDateForDayName(mealPlan.week_of, entry.day),
            meal_type: mealType,
            portion_multiplier: entry.portionMultiplier || 1,
            slot_label: entry.slotLabel || `${entry.day} ${entry.mealType}`
          })
          return acc
        }, { inserts: [], missingRecipeRefs: [] }).inserts
      : recipeIds.map((recipeId, index) => ({
          meal_plan_id: mealPlanId,
          recipe_id: recipeId,
          planned_for_date: getDateForMealIndex(mealPlan.week_of, index),
          portion_multiplier: 1
        }))

    await supabase
      .from('meal_plan_recipes')
      .insert(mealPlanRecipes)

    // Create grocery list
    const groceryItems: GroceryItemInsert[] = aiMealPlan.grocery_list.map(item => ({
      meal_plan_id: mealPlanId,
      item_name: item.item,
      quantity: parseQuantity(item.quantity),
      unit: parseUnit(item.quantity),
      purchased: false
    }))

    await supabase
      .from('grocery_items')
      .insert(groceryItems)

    // Track which adjustments were applied
    const appliedAdjustments: string[] = []
    if (adjustments.reduceTime) appliedAdjustments.push('reduceTime')
    if (adjustments.lowerBudget) appliedAdjustments.push('lowerBudget')
    if (adjustments.minimizeIngredients) appliedAdjustments.push('minimizeIngredients')

    // Update meal plan with applied adjustments
    const updatedSnapshot = {
      ...mealPlan.survey_snapshot,
      applied_adjustments: [
        ...(mealPlan.survey_snapshot?.applied_adjustments || []),
        ...appliedAdjustments
      ]
    }

    await supabase
      .from('meal_plans')
      .update({
        survey_snapshot: updatedSnapshot,
        total_meals: scheduleEntries.length > 0 ? scheduleEntries.length : recipeIds.length
      })
      .eq('id', mealPlanId)

    // Track action for feedback
    const adjustmentsList = []
    if (adjustments.reduceTime) adjustmentsList.push('reduce time')
    if (adjustments.lowerBudget) adjustmentsList.push('lower budget')
    if (adjustments.minimizeIngredients) adjustmentsList.push('minimize ingredients')

    await trackMealPlanAction(
      mealPlanId,
      user.id,
      `User applied optimizations: ${adjustmentsList.join(', ')}`
    )

    revalidateTag('meal-plan')
    revalidateTag('dashboard')

    return { success: true }
  } catch (error) {
    logUnexpectedError('regenerateWithAdjustments', error, {
      mealPlanId,
      adjustments
    })
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Feature 4: Scale recipe servings
 */
export async function scaleRecipeServings(
  mealPlanId: string,
  recipeId: string,
  multiplier: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Get recipe
    const { data: recipe } = await supabase
      .from('full_recipes_table')
      .select('*')
      .eq('id', recipeId)
      .single()

    if (!recipe) {
      return { success: false, error: 'Recipe not found' }
    }

    // Scale ingredients
    const ingredients = (recipe.ingredients ?? []) as RecipeIngredient[]
    const scaledIngredients = ingredients.map((ingredient) => {
      const quantity = parseFloat(String(ingredient.quantity)) || 1
      const scaledQuantity = quantity * multiplier
      return {
        ...ingredient,
        quantity: scaledQuantity.toString()
      }
    })

    // Update recipe
    await supabase
      .from('full_recipes_table')
      .update({
        ingredients: scaledIngredients,
        servings: (recipe.servings || 4) * multiplier
      })
      .eq('id', recipeId)

    // Track action
    await trackMealPlanAction(
      mealPlanId,
      user.id,
      `User scaled recipe '${recipe.name}' to ${multiplier}x servings`
    )

    revalidateTag('meal-plan')

    return { success: true }
  } catch (error) {
    logUnexpectedError('scaleRecipeServings', error, {
      mealPlanId,
      recipeId,
      multiplier
    })
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Feature 5: Swap ingredient
 */
export async function swapIngredient(
  mealPlanId: string,
  recipeId: string,
  oldIngredient: string,
  newIngredient: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Get recipe
    const { data: recipe } = await supabase
      .from('full_recipes_table')
      .select('*')
      .eq('id', recipeId)
      .single()

    if (!recipe) {
      return { success: false, error: 'Recipe not found' }
    }

    // Update ingredients
    const ingredients = (recipe.ingredients ?? []) as RecipeIngredient[]
    const updatedIngredients = ingredients.map((ingredient) => {
      if (ingredient.item.toLowerCase().includes(oldIngredient.toLowerCase())) {
        return {
          ...ingredient,
          item: newIngredient
        }
      }
      return ingredient
    })

    await supabase
      .from('full_recipes_table')
      .update({ ingredients: updatedIngredients })
      .eq('id', recipeId)

    // Track action
    await trackMealPlanAction(
      mealPlanId,
      user.id,
      `User swapped '${oldIngredient}' with '${newIngredient}' in recipe '${recipe.name}'`
    )

    revalidateTag('meal-plan')

    return { success: true }
  } catch (error) {
    logUnexpectedError('swapIngredient', error, {
      mealPlanId,
      recipeId,
      oldIngredient,
      newIngredient
    })
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Feature 6: Simplify recipe
 */
export async function simplifyRecipe(
  mealPlanId: string,
  recipeId: string
): Promise<{ success: boolean; error?: string; simplifiedRecipe?: SimplifiedRecipe }> {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Get recipe
    const { data: recipe } = await supabase
      .from('full_recipes_table')
      .select('*')
      .eq('id', recipeId)
      .single()

    if (!recipe) {
      return { success: false, error: 'Recipe not found' }
    }

    // Call AI to simplify
    const prompt = simplifyRecipePrompt(
      recipe.name,
      recipe.ingredients,
      recipe.steps
    )

    const result = await callOpenAI<{ simplified_recipe: SimplifiedRecipe }>(
      'You are a culinary expert helping busy people simplify recipes. Provide simplified versions in JSON format.',
      prompt,
      (response) => {
        const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) || response.match(/```\n?([\s\S]*?)\n?```/)
        const jsonStr = jsonMatch ? jsonMatch[1] : response
        return JSON.parse(jsonStr)
      }
    )

    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to simplify recipe' }
    }

    const { simplified_recipe } = result.data

    // Update recipe with simplified version
    const simplifiedIngredients = (simplified_recipe.ingredients ?? []) as RecipeIngredient[]
    await supabase
      .from('full_recipes_table')
      .update({
        name: simplified_recipe.name,
        ingredients: simplifiedIngredients,
        steps: simplified_recipe.steps
      })
      .eq('id', recipeId)

    // Track action
    await trackMealPlanAction(
      mealPlanId,
      user.id,
      `User requested simplified version of '${recipe.name}'`
    )

    revalidateTag('meal-plan')

    return { success: true, simplifiedRecipe: simplified_recipe }
  } catch (error) {
    logUnexpectedError('simplifyRecipe', error, {
      mealPlanId,
      recipeId
    })
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Helper functions
function getDateForMealIndex(weekOf: string, index: number): string {
  const startDate = new Date(weekOf)
  const dayOffset = index % 7
  const mealDate = new Date(startDate)
  mealDate.setDate(startDate.getDate() + dayOffset)
  return mealDate.toISOString().split('T')[0]
}


function parseQuantity(quantityStr: string): number | undefined {
  const match = quantityStr.match(/^([\d.]+)/)
  return match ? parseFloat(match[1]) : undefined
}

function parseUnit(quantityStr: string): string | undefined {
  const match = quantityStr.match(/^[\d.]+\s*(.+)/)
  return match ? match[1].trim() : undefined
}

/**
 * Replace recipe with a saved recipe
 * Replaces ALL occurrences of a recipe with an existing saved recipe
 */
export async function replaceRecipeWithSaved(
  mealPlanId: string,
  recipeId: string,
  savedRecipeId: string,
  mealType: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[replaceRecipeWithSaved] Starting replacement', { mealPlanId, recipeId, savedRecipeId, mealType })
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logAuthError('replaceRecipeWithSaved', authError || new Error('User not found'), {
        operation: 'getUser',
        authErrorType: authError ? 'auth_error' : 'user_not_found'
      })
      return { success: false, error: 'User not authenticated' }
    }
    console.log('[replaceRecipeWithSaved] User authenticated:', user.id)

    // Get meal plan with total_ingredients
    const { data: mealPlan, error: mealPlanError } = await supabase
      .from('meal_plans')
      .select('*, meal_plan_recipes(*, recipe:full_recipes_table(*))')
      .eq('id', mealPlanId)
      .eq('user_id', user.id)
      .single()

    if (mealPlanError || !mealPlan) {
      logDatabaseError('replaceRecipeWithSaved', mealPlanError || new Error('Meal plan not found'), {
        table: 'meal_plans',
        operation: 'SELECT',
        queryParams: { id: mealPlanId, user_id: user.id }
      }, user.id)
      return { success: false, error: 'Meal plan not found' }
    }

    // Find ALL meal_plan_recipes that use this recipe_id
    const mealPlanRecipesToReplace = mealPlan.meal_plan_recipes.filter(
      (mpr: any) => String(mpr.recipe_id) === String(recipeId) || String(mpr.updated_recipe_id) === String(recipeId)
    )

    if (mealPlanRecipesToReplace.length === 0) {
      logValidationError('replaceRecipeWithSaved', new Error('No meal plan recipes found'), {
        validationType: 'recipe_existence',
        field: 'recipeId',
        input: recipeId,
        reason: 'No meal_plan_recipes found matching recipe_id'
      }, user.id)
      return { success: false, error: 'No meal plan recipes found with this recipe' }
    }

    // Get the recipe being replaced
    let oldRecipe: any = null
    const { data: recipeFromRecipes } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single()
    
    if (recipeFromRecipes) {
      oldRecipe = recipeFromRecipes
    } else {
      const { data: recipeFromFull } = await supabase
        .from('full_recipes_table')
        .select('*')
        .eq('recipe_id', recipeId)
        .single()
      
      if (recipeFromFull) {
        oldRecipe = recipeFromFull
      }
    }

    if (!oldRecipe) {
      logDatabaseError('replaceRecipeWithSaved', new Error('Recipe not found'), {
        table: 'recipes/full_recipes_table',
        operation: 'SELECT',
        queryParams: { recipeId }
      }, user.id)
      return { success: false, error: 'Recipe not found' }
    }

    // Get the saved recipe
    const { data: savedRecipe, error: savedRecipeError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', savedRecipeId)
      .single()

    if (savedRecipeError || !savedRecipe) {
      logDatabaseError('replaceRecipeWithSaved', savedRecipeError || new Error('Saved recipe not found'), {
        table: 'recipes',
        operation: 'SELECT',
        queryParams: { id: savedRecipeId }
      }, user.id)
      return { success: false, error: 'Saved recipe not found' }
    }
    console.log('[replaceRecipeWithSaved] Using saved recipe:', savedRecipe.name)

    // Get current total_ingredients
    let currentTotalIngredients: { items: Array<{ item: string; quantity: string; checked?: boolean }>; seasonings: Array<{ item: string; quantity: string; checked?: boolean }> }
    if (Array.isArray(mealPlan.total_ingredients)) {
      currentTotalIngredients = {
        items: mealPlan.total_ingredients,
        seasonings: []
      }
    } else if (mealPlan.total_ingredients && typeof mealPlan.total_ingredients === 'object' && ('items' in mealPlan.total_ingredients || 'seasonings' in mealPlan.total_ingredients)) {
      currentTotalIngredients = {
        items: (mealPlan.total_ingredients as any).items || [],
        seasonings: (mealPlan.total_ingredients as any).seasonings || []
      }
    } else {
      currentTotalIngredients = { items: [], seasonings: [] }
    }

    // Get old recipe ingredients
    const oldRecipeIngredients = (oldRecipe.ingredients || []) as Array<{ item: string; quantity: string }>
    const newRecipeIngredients = (savedRecipe.ingredients || []) as Array<{ item: string; quantity: string }>

    // Helper function to parse quantity
    const parseQuantity = (qtyStr: string): number => {
      const match = qtyStr.match(/^([\d.]+)/)
      return match ? parseFloat(match[1]) : 0
    }

    // Helper function to parse unit
    const parseUnit = (qtyStr: string): string => {
      const match = qtyStr.match(/^[\d.]+\s*(.+)/)
      return match ? match[1].trim() : ''
    }

    // Helper function to normalize ingredient name
    const normalizeName = (name: string): string => name.toLowerCase().trim()

    // Preserve checked state from current total_ingredients
    const currentCheckedState = new Map<string, boolean>()
    if (currentTotalIngredients.items) {
      currentTotalIngredients.items.forEach(item => {
        if (item.checked !== undefined) {
          currentCheckedState.set(normalizeName(item.item), item.checked)
        }
      })
    }
    if (currentTotalIngredients.seasonings) {
      currentTotalIngredients.seasonings.forEach(item => {
        if (item.checked !== undefined) {
          currentCheckedState.set(normalizeName(item.item), item.checked)
        }
      })
    }

    // Create maps for easier lookup and updating
    const itemsMap = new Map<string, { item: string; quantity: number; unit: string }>()
    const seasoningsMap = new Map<string, { item: string; quantity: number; unit: string }>()

    // Helper to determine if ingredient is a seasoning
    const isSeasoning = (itemName: string): boolean => {
      const name = normalizeName(itemName)
      const seasoningKeywords = ['salt', 'pepper', 'paprika', 'cumin', 'turmeric', 'cinnamon', 'nutmeg', 'oregano', 'basil', 'thyme', 'rosemary', 'curry', 'chili powder', 'garlic powder', 'onion powder', 'cayenne', 'cumin', 'garam masala']
      return seasoningKeywords.some(keyword => name.includes(keyword))
    }

    // Initialize maps with current ingredients
    currentTotalIngredients.items.forEach(ing => {
      const key = `${normalizeName(ing.item)}|${parseUnit(ing.quantity)}`
      itemsMap.set(key, {
        item: ing.item,
        quantity: parseQuantity(ing.quantity),
        unit: parseUnit(ing.quantity)
      })
    })

    currentTotalIngredients.seasonings.forEach(ing => {
      const key = `${normalizeName(ing.item)}|${parseUnit(ing.quantity)}`
      seasoningsMap.set(key, {
        item: ing.item,
        quantity: parseQuantity(ing.quantity),
        unit: parseUnit(ing.quantity)
      })
    })

    // Subtract old recipe ingredients
    oldRecipeIngredients.forEach(ing => {
      const unit = parseUnit(ing.quantity)
      const qty = parseQuantity(ing.quantity)
      const key = `${normalizeName(ing.item)}|${unit}`
      const map = isSeasoning(ing.item) ? seasoningsMap : itemsMap
      
      const existing = map.get(key)
      if (existing) {
        existing.quantity -= qty
        if (existing.quantity <= 0) {
          map.delete(key)
        }
      }
    })

    // Add new recipe ingredients
    newRecipeIngredients.forEach(ing => {
      const unit = parseUnit(ing.quantity)
      const qty = parseQuantity(ing.quantity)
      const key = `${normalizeName(ing.item)}|${unit}`
      const map = isSeasoning(ing.item) ? seasoningsMap : itemsMap
      
      const existing = map.get(key)
      if (existing) {
        existing.quantity += qty
      } else {
        map.set(key, {
          item: ing.item,
          quantity: qty,
          unit: unit
        })
      }
    })

    // Convert maps back to arrays and preserve checked state
    const updatedItems = Array.from(itemsMap.values())
      .filter(item => item.quantity > 0)
      .map(item => ({
        item: item.item,
        quantity: `${item.quantity}${item.unit ? ' ' + item.unit : ''}`.trim(),
        checked: currentCheckedState.get(normalizeName(item.item)) ?? false
      }))
      .sort((a, b) => a.item.localeCompare(b.item))

    const updatedSeasonings = Array.from(seasoningsMap.values())
      .filter(item => item.quantity > 0)
      .map(item => ({
        item: item.item,
        quantity: `${item.quantity}${item.unit ? ' ' + item.unit : ''}`.trim(),
        checked: currentCheckedState.get(normalizeName(item.item)) ?? false
      }))
      .sort((a, b) => a.item.localeCompare(b.item))

    const updatedTotalIngredients = {
      items: updatedItems,
      seasonings: updatedSeasonings
    }

    // Update meal_plan_recipes with saved recipe ID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recipeId)
    const isInteger = /^\d+$/.test(recipeId)
    
    let totalUpdated = 0
    let updateError: any = null
    
    if (isUUID) {
      const { data: updated, error: error } = await supabase
        .from('meal_plan_recipes')
        .update({ updated_recipe_id: savedRecipeId })
        .eq('meal_plan_id', mealPlanId)
        .eq('updated_recipe_id', recipeId)
        .select('id')
      
      totalUpdated = updated?.length || 0
      updateError = error
    } else if (isInteger) {
      const { data: updated, error: error } = await supabase
        .from('meal_plan_recipes')
        .update({ updated_recipe_id: savedRecipeId })
        .eq('meal_plan_id', mealPlanId)
        .eq('recipe_id', parseInt(recipeId, 10))
        .select('id')
      
      totalUpdated = updated?.length || 0
      updateError = error
    } else {
      // Try both methods
      const { data: updated1, error: error1 } = await supabase
        .from('meal_plan_recipes')
        .update({ updated_recipe_id: savedRecipeId })
        .eq('meal_plan_id', mealPlanId)
        .eq('updated_recipe_id', recipeId)
        .select('id')
      
      let updated2: any[] = []
      let error2: any = null
      if (!updated1 || updated1.length === 0) {
        const parsedInt = parseInt(recipeId, 10)
        if (!isNaN(parsedInt)) {
          const result = await supabase
            .from('meal_plan_recipes')
            .update({ updated_recipe_id: savedRecipeId })
            .eq('meal_plan_id', mealPlanId)
            .eq('recipe_id', parsedInt)
            .select('id')
          updated2 = result.data || []
          error2 = result.error
        }
      }
      
      totalUpdated = (updated1?.length || 0) + (updated2?.length || 0)
      updateError = error1 || error2
    }
    
    if (updateError) {
      logDatabaseError('replaceRecipeWithSaved', updateError, {
        table: 'meal_plan_recipes',
        operation: 'UPDATE',
        queryParams: { meal_plan_id: mealPlanId, recipeId, savedRecipeId }
      }, user.id)
      return { success: false, error: `Failed to update meal plan recipes: ${updateError.message}` }
    }
    
    if (totalUpdated === 0) {
      logValidationError('replaceRecipeWithSaved', new Error('No records were updated'), {
        validationType: 'update_count',
        reason: 'No meal plan recipes were updated'
      }, user.id)
      return { success: false, error: 'No meal plan recipes were updated' }
    }

    // Update meal plan's total_ingredients
    const { error: totalIngredientsError } = await supabase
      .from('meal_plans')
      .update({ total_ingredients: updatedTotalIngredients })
      .eq('id', mealPlanId)

    if (totalIngredientsError) {
      logDatabaseError('replaceRecipeWithSaved', totalIngredientsError, {
        table: 'meal_plans',
        operation: 'UPDATE',
        queryParams: { id: mealPlanId, user_id: user.id }
      }, user.id)
      // Don't fail the whole operation, but log the error
    }

    // Track action
    try {
      await trackMealPlanAction(
        mealPlanId,
        user.id,
        `User replaced recipe '${oldRecipe.name}' with saved recipe '${savedRecipe.name}' (${totalUpdated} occurrence${totalUpdated === 1 ? '' : 's'})`
      )
    } catch (trackError) {
      console.warn('[replaceRecipeWithSaved] Failed to track action:', trackError)
    }

    revalidateTag('meal-plan')
    revalidateTag('dashboard')

    console.log('[replaceRecipeWithSaved] Replacement completed successfully')
    return { success: true }
  } catch (error) {
    logUnexpectedError('replaceRecipeWithSaved', error, {
      mealPlanId,
      recipeId,
      savedRecipeId,
      mealType
    })
    return { 
      success: false, 
      error: `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}` 
    }
  }
}

/**
 * Save a cooking note to a recipe
 * This adds AI-generated cooking tips to the recipe's cooking_notes array
 */
export async function saveCookingNote(
  recipeId: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Validate input
    if (!note || note.trim().length === 0) {
      return { success: false, error: 'Note cannot be empty' }
    }

    if (note.length > 500) {
      return { success: false, error: 'Note is too long' }
    }

    // Get current recipe to append to cooking_notes
    const { data: recipe, error: fetchError } = await supabase
      .from('recipes')
      .select('cooking_notes')
      .eq('id', recipeId)
      .single()

    if (fetchError) {
      logDatabaseError('saveCookingNote', fetchError, {
        table: 'recipes',
        operation: 'SELECT',
        queryParams: { id: recipeId }
      })
      return { success: false, error: 'Recipe not found' }
    }

    // Append note to existing notes (or create new array)
    const existingNotes = recipe.cooking_notes || []
    const updatedNotes = [...existingNotes, note.trim()]

    // Update recipe with new notes
    const { error: updateError } = await supabase
      .from('recipes')
      .update({ cooking_notes: updatedNotes })
      .eq('id', recipeId)

    if (updateError) {
      logDatabaseError('saveCookingNote', updateError, {
        table: 'recipes',
        operation: 'UPDATE',
        queryParams: { id: recipeId }
      })
      return { success: false, error: 'Failed to save note' }
    }

    // Revalidate to refresh the UI
    revalidateTag('meal-plans')

    return { success: true }
  } catch (error) {
    logUnexpectedError('saveCookingNote', error, {
      recipeId,
      noteLength: note.length
    })
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save note' 
    }
  }
}


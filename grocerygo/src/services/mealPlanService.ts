import { createClient } from '@/utils/supabase/server'
import type { MealPlan, MealPlanInsert, MealPlanRecipeInsert, RecipeInsert, GroceryItemInsert, MatchRecipeResult } from '@/types/database'
import { 
  embeddingPromptsSystemPrompt, 
  embeddingPromptsUserPromptTemplate 
} from '@/app/meal-plan-generate/prompts';
import { generateText } from 'ai'
import OpenAI from "openai";
import { z } from 'zod';
import { getDateForDayName } from '@/utils/mealPlanDates'



type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export interface MealPlanContext {
  supabase: SupabaseClient
  user: NonNullable<Awaited<ReturnType<SupabaseClient['auth']['getUser']>>['data']['user']>
}

export interface RecipeInput {
  id?: string
  name: string
  mealType?: string
  description?: string
  ingredients: Array<{ item: string; quantity: string }>
  steps: string[]
  prep_time_minutes?: number
  cook_time_minutes?: number
  servings?: number
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  cuisine_type?: string[]
  dietary_tags?: string[]
  flavor_profile?: string[]
  estimated_cost?: number
  nutrition_info?: number[]
}

export interface GroceryItemInput {
  item: string
  quantity: string
}

export interface ScheduleInput {
  slotLabel: string
  day: string
  mealType: string
  recipeId: string
  portionMultiplier: number
}

export async function createMealPlanContext(): Promise<MealPlanContext> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('User not authenticated')
  }

  return { supabase, user }
}

export async function fetchUserSurveyResponse(context: MealPlanContext) {
  const { supabase, user } = context
  const { data } = await supabase
    .from('users')
    .select('survey_response')
    .eq('user_id', user.id)
    .single()

  return data?.survey_response
}

export async function findExistingMealPlanByWeek(
  context: MealPlanContext,
  weekOf: string
) {
  const { supabase, user } = context
  const { data } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('user_id', user.id)
    .eq('week_of', weekOf)
    .single()

  return data
}

export async function insertGeneratingMealPlan(
  context: MealPlanContext,
  payload: Omit<MealPlanInsert, 'user_id'> & {
    survey_snapshot?: Record<string, unknown>
  }
): Promise<MealPlan> {
  const { supabase, user } = context
  const { data, error } = await supabase
    .from('meal_plans')
    .insert({
      ...payload,
      user_id: user.id
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create meal plan')
  }

  return data
}

export async function getMealPlanForUser(
  context: MealPlanContext,
  mealPlanId: string
): Promise<MealPlan | null> {
  const { supabase, user } = context

  const { data, error } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', mealPlanId)
    .eq('user_id', user.id)
    .single()

  if (error) {
    return null
  }

  return data
}

export async function deleteMealPlanForUser(
  context: MealPlanContext,
  mealPlanId: string
) {
  const { supabase, user } = context
  const { error } = await supabase
    .from('meal_plans')
    .delete()
    .eq('id', mealPlanId)
    .eq('user_id', user.id)

  if (error) {
    throw new Error(error.message || 'Failed to delete existing meal plan')
  }
}

export interface PersistMealPlanParams {
  mealPlan: MealPlan
  recipes: RecipeInput[]
  groceryList: GroceryItemInput[]
  schedule?: ScheduleInput[]
}

export async function persistGeneratedMealPlan(
  context: MealPlanContext,
  params: PersistMealPlanParams
) {
  const { supabase } = context
  const { mealPlan, recipes, groceryList, schedule = [] } = params

  if (!recipes.length) {
    throw new Error('No recipes provided to persist')
  }

  // Validate that all recipes have IDs (from full_recipes_table)
  const recipesWithoutIds = recipes.filter((r) => !r.id)
  if (recipesWithoutIds.length > 0) {
    throw new Error(
      `All recipes must have IDs. Found ${recipesWithoutIds.length} recipe(s) without IDs.`
    )
  }

  // Fetch existing recipes by ID to verify they exist and get their current data
  const recipeIds = recipes.map((r) => r.id!).filter(Boolean)
  const { data: fetchedRecipes, error: fetchError } = await supabase
    .from('full_recipes_table')
    .select('recipe_id, name, times_used')
    .in('recipe_id', recipeIds)

  if (fetchError) {
    throw new Error(
      fetchError.message || 'Failed to fetch existing recipes'
    )
  }

  if (!fetchedRecipes || fetchedRecipes.length === 0) {
    throw new Error('No recipes found in database for the provided IDs')
  }

  const existingRecipes = fetchedRecipes as Array<{ recipe_id: string; name: string; times_used?: number }>
  
  // Verify all requested recipe IDs were found
  const foundIds = new Set(fetchedRecipes.map((r) => r.recipe_id))

  // Increment times_used for existing recipes
  for (const recipe of existingRecipes) {
    const currentTimesUsed = recipe.times_used ?? 0
    const { error: updateError } = await supabase
      .from('full_recipes_table')
      .update({ times_used: currentTimesUsed + 1 })
      .eq('recipe_id', recipe.recipe_id)

    if (updateError) {
      throw new Error(
        updateError.message || `Failed to update times_used for recipe ${recipe.recipe_id}`
      )
    }
  }

  // Insert modified recipes into recipes table
  const modifiedRecipeMap = new Map<string, string>() // parent_id (int4) -> modified_uuid
  const recipeErrors: string[] = []

  for (const recipe of recipes) {
    if (!recipe.id) {
      recipeErrors.push(`${recipe.name}: missing recipe id`)
      continue
    }

    // Map RecipeInput to RecipeInsert format
    const recipeInsert: RecipeInsert = {
      name: recipe.name,
      ingredients: recipe.ingredients.map(ing => ({
        item: ing.item,
        quantity: ing.quantity,
        unit: ing.quantity.split(/\s+/).slice(1).join(' ') || undefined
      })),
      steps: recipe.steps,
      servings: recipe.servings,
      meal_type: recipe.mealType ? recipe.mealType.toLowerCase() : undefined,
      description: recipe.description,
      prep_time_minutes: recipe.prep_time_minutes,
      cook_time_minutes: recipe.cook_time_minutes,
      difficulty: recipe.difficulty,
      cuisine_type: recipe.cuisine_type,
      dietary_tags: recipe.dietary_tags,
      flavor_profile: recipe.flavor_profile,
      estimated_cost: recipe.estimated_cost,
      nutrition_info: recipe.nutrition_info && Array.isArray(recipe.nutrition_info) && recipe.nutrition_info.length >= 4
        ? {
            calories: recipe.nutrition_info[0] || undefined,
            protein: recipe.nutrition_info[1] || undefined,
            carbs: recipe.nutrition_info[2] || undefined,
            fat: recipe.nutrition_info[3] || undefined
          }
        : undefined
    }

    // Insert modified recipe into recipes table
    const { data: newRecipe, error: recipeError } = await supabase
      .from('recipes')
      .insert(recipeInsert)
      .select('id')
      .single()

    if (recipeError) {
      recipeErrors.push(`${recipe.name}: ${recipeError.message}`)
      continue
    }

    if (newRecipe) {
      // Map parent recipe_id (int4) to new recipe UUID
      modifiedRecipeMap.set(recipe.id, newRecipe.id)
    }
  }

  if (recipeErrors.length > 0 && modifiedRecipeMap.size === 0) {
    throw new Error(
      `Failed to create any modified recipes. Errors: ${recipeErrors.join('; ')}`
    )
  }

  const typedInsertedRecipes = existingRecipes as Array<{ recipe_id: string; name: string }>

  const mealPlanRecipes: MealPlanRecipeInsert[] =
    schedule.length > 0
      ? schedule.reduce<MealPlanRecipeInsert[]>((acc, slot, index) => {

          // Ensure portion_multiplier is always a valid integer
          let portionMultiplier = 1
          if (slot.portionMultiplier !== undefined && slot.portionMultiplier !== null) {
            const parsed = typeof slot.portionMultiplier === 'number' 
              ? slot.portionMultiplier 
              : parseInt(String(slot.portionMultiplier), 10)
            
            // Only use parsed value if it's a valid positive integer
            if (!isNaN(parsed) && parsed > 0 && Number.isInteger(parsed)) {
              portionMultiplier = parsed
            }
          }

          // Get parent recipe_id (int4) and modified recipe UUID
          const parentRecipeId = parseInt(slot.recipeId)
          const updatedRecipeId = modifiedRecipeMap.get(slot.recipeId)

          acc.push({
            meal_plan_id: mealPlan.id,
            recipe_id: parentRecipeId,
            updated_recipe_id: updatedRecipeId,
            planned_for_date: getDateForDayName(mealPlan.week_of, slot.day),
            meal_type: normalizeMealType(slot.mealType),
            portion_multiplier: portionMultiplier,
            slot_label: slot.slotLabel || `${slot.day} ${slot.mealType}`
          })

          return acc
        }, [])
      : typedInsertedRecipes.map((recipe, index) => {
          const updatedRecipeId = modifiedRecipeMap.get(recipe.recipe_id)
          return {
            meal_plan_id: mealPlan.id,
            recipe_id: parseInt(recipe.recipe_id),
            updated_recipe_id: updatedRecipeId,
            planned_for_date: getDateForMealIndex(mealPlan.week_of, index),
            portion_multiplier: 1
          }
        })

  if (mealPlanRecipes.length) {
    const { error: linkError } = await supabase
      .from('meal_plan_recipes')
      .insert(mealPlanRecipes)

    if (linkError) {
      throw new Error(linkError.message || 'Failed to link recipes to meal plan')
    }
  }

  if (groceryList.length) {
    const groceryItems: GroceryItemInsert[] = groceryList.map((item) => ({
      meal_plan_id: mealPlan.id,
      item_name: item.item,
      quantity: parseQuantity(item.quantity),
      unit: parseUnit(item.quantity),
      purchased: false
    }))

    const { error: groceryError } = await supabase
      .from('grocery_items')
      .insert(groceryItems)

    if (groceryError) {
      throw new Error(
        groceryError.message || 'Failed to create grocery list items'
      )
    }
  }

  const { error: updateError } = await supabase
    .from('meal_plans')
    .update({
      status: 'pending',
      total_meals: schedule.length > 0 ? schedule.length : typedInsertedRecipes.length
    })
    .eq('id', mealPlan.id)

  if (updateError) {
    throw new Error(
      updateError.message || 'Failed to update meal plan status after generation'
    )
  }
}


function normalizeMealType(mealType?: string) {
  return mealType
    ? (mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner' | undefined)
    : undefined
}

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

export async function fetchCandidateRecipesForMealType(
  embedPrompt: string,
  context: MealPlanContext, 
  mealType: string, 
  matchCount: number, 
  maxMinutes?: number
): Promise<string[]> {
  const { supabase, user } = context;

  try {
    const embedding: Number[] = await generateEmbeddingFromPrompt(embedPrompt);

    const { data, error } = await supabase.rpc('match_recipe_ids_with_history_exclusion', {
      p_user_id: user.id,
      p_query_embedding: embedding,
      p_match_count: matchCount,
      p_meal_type_filter: mealType ?? null,
      p_max_minutes: maxMinutes ?? null,
    })

    if (error) throw error

    const results = data as MatchRecipeResult[]
    const recipeIds: string[] = (results ?? []).map(row => row.recipe_id)

    return recipeIds;
    
  } catch(error){
    console.error("An error occured while fetching the candidate recipes:", {error, mealType});
    throw new Error(
      'CRITICAL: Failed to generate candidate recipes. Meal plan generation aborted.',
      { cause: error as Error }
    )
  }

}

export interface FullRecipeDetails {
  recipe_id: string
  name: string
  nutrition?: {
    calories?: number
    protein?: number
    carbs?: number
    fat?: number
  }
  steps: string[]
  description?: string
  ingredients: Array<{ item: string; quantity: string }>
  meal_type?: string
}

export async function fetchRecipeDetailsByIds(
  context: MealPlanContext,
  recipeIds: string[]
): Promise<FullRecipeDetails[]> {
  const { supabase } = context

  if (!recipeIds || recipeIds.length === 0) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('full_recipes_table')
      .select('recipe_id, name, nutrition, steps, description, ingredients, meal_type')
      .in('recipe_id', recipeIds)

    if (error) {
      throw error
    }

    return (data ?? []) as FullRecipeDetails[]
  } catch (error) {
    console.error("An error occurred while fetching recipe details:", { error, recipeIds })
    throw new Error(
      'CRITICAL: Failed to fetch recipe details. Meal plan generation aborted.',
      { cause: error as Error }
    )
  }
}

async function generateEmbeddingFromPrompt(embedPrompt: string): Promise<Number[]> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  try {
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: embedPrompt,
    });

    if (!embeddingResponse || !embeddingResponse.data) {
      throw new Error('Embedding response returned empty');
    }
      
    return embeddingResponse.data[0].embedding;
  } catch (error) {
    console.error("An error occured while generating the embedding:", {error, embedPrompt});
    throw new Error(
      'CRITICAL: Failed to generate embedding. Meal plan generation aborted.',
      { cause: error as Error }
    )
  }
}

// Zod schema for embedding prompts response
const EmbeddingPromptsSchema = z.object({
  breakfast: z.string()
    .min(8)
    .max(200)
    .describe('A concise 8-15 word phrase for breakfast recipe search'),
  lunch: z.string()
    .min(8)
    .max(200)
    .describe('A concise 8-15 word phrase for lunch recipe search'),
  dinner: z.string()
    .min(8)
    .max(200)
    .describe('A concise 8-15 word phrase for dinner recipe search')
});

export type EmbeddingPrompts = z.infer<typeof EmbeddingPromptsSchema>;

/**
 * Generates embedding prompts for breakfast, lunch, and dinner in a single LLM call.
 */
export async function getEmbedPrompts(surveyData: any): Promise<EmbeddingPrompts> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const userPrompt = embeddingPromptsUserPromptTemplate(surveyData);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        {
          role: 'system',
          content: embeddingPromptsSystemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new Error('No response generated from AI');
    }

    // Parse the JSON response
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(response);
    } catch (parseError) {
      throw new Error(`Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    // Basic validation that we got an object with the expected structure
    if (typeof parsedData !== 'object' || parsedData === null) {
      throw new Error('AI response is not a valid object');
    }

    const data = parsedData as { breakfast?: string; lunch?: string; dinner?: string };

    if (!data.breakfast || !data.lunch || !data.dinner) {
      throw new Error('AI response is missing required fields (breakfast, lunch, or dinner)');
    }

    // Validate that all prompts are non-empty
    if (!data.breakfast.trim() || !data.lunch.trim() || !data.dinner.trim()) {
      throw new Error('One or more embedding prompts are empty');
    }

    return {
      breakfast: data.breakfast.trim(),
      lunch: data.lunch.trim(),
      dinner: data.dinner.trim()
    };
  } catch (error) {
    console.error("An error occurred while generating the embed prompts:", {error, surveyData});
    throw new Error(
      'CRITICAL: Failed to generate embedding prompts. Meal plan generation aborted.',
      { cause: error as Error }
    );
  }
}

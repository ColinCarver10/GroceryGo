'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { assertWithinDailyAIQuota } from '@/app/actions/quota'
import { callOpenAI } from '@/app/actions/aiHelper'
import { ImportedRecipeSchema } from '@/app/schemas/mealPlanSchemas'
import { getImportRecipeSystemPrompt, getImportRecipeUserPrompt } from '@/app/actions/importRecipePrompts'
import { extractRecipeSource, validateImportUrl } from '@/utils/recipeImportExtractor'
import { normalizeImportedRecipePayload } from '@/utils/importRecipeNormalization'
import { logApiError, logAuthError, logDatabaseError, logUnexpectedError, logValidationError } from '@/utils/errorLogger'
import type { Recipe } from '@/types/database'

const ImportRecipeInputSchema = z.object({
  url: z.string().trim().min(1).max(2048)
})

type SavedRecipeWithRecipe = {
  id: string
  recipe_id: string
  created_at: string
  recipe: Recipe
}

const importRecipeDeps = {
  createClient,
  assertWithinDailyAIQuota,
  extractRecipeSource,
  callOpenAI,
  revalidateTag
}

export async function importRecipeFromUrl(
  input: unknown
): Promise<{ success: true; savedRecipe: SavedRecipeWithRecipe } | { success: false; error: string }> {
  try {
    const parsed = ImportRecipeInputSchema.safeParse(input)
    if (!parsed.success) {
      logValidationError('importRecipeFromUrl', parsed.error, {
        validationType: 'input_schema',
        field: 'url',
        reason: 'Invalid import URL payload',
        input
      })
      return { success: false, error: 'Please provide a valid URL.' }
    }

    const validatedUrl = validateImportUrl(parsed.data.url)
    if (!validatedUrl.ok) {
      return { success: false, error: validatedUrl.error }
    }

    const supabase = await importRecipeDeps.createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError || !authData.user) {
      logAuthError('importRecipeFromUrl', authError || new Error('User not found'), {
        operation: 'getUser',
        authErrorType: authError ? 'auth_error' : 'user_not_found'
      })
      return { success: false, error: 'Not authenticated' }
    }

    const userId = authData.user.id

    await importRecipeDeps.assertWithinDailyAIQuota(supabase)

    const extracted = await importRecipeDeps.extractRecipeSource(validatedUrl.url.toString())
    if (!extracted.rawText || extracted.rawText.trim().length < 120) {
      return { success: false, error: 'Not enough extractable content in this URL to parse a recipe.' }
    }

    const aiResult = await importRecipeDeps.callOpenAI(
      getImportRecipeSystemPrompt(),
      getImportRecipeUserPrompt(extracted),
      parseImportedRecipeResponse
    )

    if (!aiResult.success || !aiResult.data) {
      logApiError('importRecipeFromUrl', new Error(aiResult.error || 'AI parse failed'), {
        endpoint: 'OpenAI API',
        method: 'POST',
        requestBody: {
          schema: 'ImportedRecipeSchema (post-parse validated)',
          sourceType: extracted.sourceType,
          sourceUrl: extracted.sourceUrl
        }
      }, userId)
      return { success: false, error: aiResult.error || 'Failed to extract recipe from this URL.' }
    }

    const normalizedCandidate = normalizeImportedRecipePayload(aiResult.data)
    const importedResult = ImportedRecipeSchema.safeParse(normalizedCandidate)
    if (!importedResult.success) {
      logValidationError('importRecipeFromUrl', importedResult.error, {
        validationType: 'imported_recipe_schema',
        field: 'ImportedRecipeSchema',
        reason: 'AI response failed post-parse schema validation',
        input: {
          sourceType: extracted.sourceType,
          sourceUrl: extracted.sourceUrl,
          normalizedCandidate
        }
      }, userId)

      return {
        success: false,
        error: 'Could not confidently parse ingredient quantities. Try another link or copy-paste the caption.'
      }
    }

    const imported = importedResult.data
    const recipeForSave = {
      ...imported,
      servings: 1
    }
    if (imported.confidence < 0.35) {
      return {
        success: false,
        error: 'Could not confidently parse this recipe. Try a different link or copy-paste the caption.'
      }
    }

    const { data: existingSaved, error: existingError } = await supabase
      .from('saved_recipes')
      .select(`
        id,
        recipe_id,
        created_at,
        recipe:recipes!inner (*)
      `)
      .eq('user_id', userId)
      .limit(200)

    if (existingError) {
      logDatabaseError('importRecipeFromUrl', existingError, {
        table: 'saved_recipes',
        operation: 'SELECT',
        queryParams: { user_id: userId, check: 'duplicate_name' }
      }, userId)
    }

    const duplicate = (existingSaved || []).find((item) => {
      const recipeName = String((item as { recipe?: { name?: string } })?.recipe?.name || '').trim().toLowerCase()
      return recipeName.length > 0 && recipeName === imported.name.trim().toLowerCase()
    })
    if (duplicate?.recipe) {
      return { success: false, error: 'You already have this recipe saved.' }
    }

    const { data: recipe, error: recipeInsertError } = await supabase
      .from('recipes')
      .insert({
        name: recipeForSave.name.trim(),
        description: recipeForSave.description?.trim() || null,
        ingredients: recipeForSave.ingredients,
        steps: recipeForSave.steps,
        prep_time_minutes: recipeForSave.prep_time_minutes ?? null,
        cook_time_minutes: recipeForSave.cook_time_minutes ?? null,
        servings: recipeForSave.servings,
        difficulty: recipeForSave.difficulty ?? null,
        meal_type: recipeForSave.mealType ? [recipeForSave.mealType.toLowerCase()] : null,
        times_used: 1
      })
      .select('*')
      .single()

    if (recipeInsertError || !recipe) {
      logDatabaseError('importRecipeFromUrl', recipeInsertError || new Error('Recipe insert failed'), {
        table: 'recipes',
        operation: 'INSERT',
        queryParams: { user_id: userId, name: imported.name }
      }, userId)
      return { success: false, error: 'Failed to save imported recipe.' }
    }

    const { data: savedRecipe, error: savedRecipeInsertError } = await supabase
      .from('saved_recipes')
      .insert({
        user_id: userId,
        recipe_id: recipe.id
      })
      .select('id, recipe_id, created_at')
      .single()

    if (savedRecipeInsertError || !savedRecipe) {
      logDatabaseError('importRecipeFromUrl', savedRecipeInsertError || new Error('Saved recipe insert failed'), {
        table: 'saved_recipes',
        operation: 'INSERT',
        queryParams: { user_id: userId, recipe_id: recipe.id }
      }, userId)
      return { success: false, error: 'Recipe was created, but we could not add it to saved recipes.' }
    }

    importRecipeDeps.revalidateTag('dashboard')

    return {
      success: true,
      savedRecipe: {
        id: savedRecipe.id,
        recipe_id: savedRecipe.recipe_id,
        created_at: savedRecipe.created_at,
        recipe: recipe as Recipe
      }
    }
  } catch (error) {
    logUnexpectedError('importRecipeFromUrl', error, {
      action: 'import_recipe_from_url'
    })
    return {
      success: false,
      error: 'Failed to import recipe from URL.'
    }
  }
}

function parseImportedRecipeResponse(response: string) {
  const candidate = extractJsonFromResponse(response)
  return JSON.parse(candidate)
}

function extractJsonFromResponse(response: string): string {
  const trimmed = response.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
  }

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim()
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  throw new Error('No JSON object found in AI response')
}

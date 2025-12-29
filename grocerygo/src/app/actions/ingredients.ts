'use server'

import { getIngredients } from '@/config/ingredients'

/**
 * Server action to fetch the list of available ingredients
 * This ensures the ingredient list is fetched server-side and cannot be modified from the frontend
 */
export async function getIngredientsList(): Promise<string[]> {
  return [...getIngredients()]
}


import type { MealPlanRecipe } from '@/types/database'

export interface CalculatedGroceryItem {
  item_name: string
  quantity: number
  unit: string
}

/**
 * Parse quantity from a string like "2 cups" -> 2
 */
function parseQuantity(quantityStr: string): number {
  const match = quantityStr.match(/^([\d.]+)/)
  return match ? parseFloat(match[1]) : 0
}

/**
 * Parse unit from a string like "2 cups" -> "cups"
 */
function parseUnit(quantityStr: string): string {
  const match = quantityStr.match(/^[\d.]+\s*(.+)/)
  return match ? match[1].trim() : ''
}

/**
 * Normalize ingredient name for case-insensitive matching
 */
function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim()
}

/**
 * Calculate grocery list from meal plan recipes
 * Aggregates ingredients by name and unit, handling portion multipliers
 */
export function calculateGroceryListFromRecipes(
  mealPlanRecipes: Array<MealPlanRecipe & { recipe?: any }>
): CalculatedGroceryItem[] {
  // Map to aggregate ingredients: key = "item_name|unit", value = total quantity
  const ingredientMap = new Map<string, { quantity: number; unit: string; item_name: string }>()

  for (const mealPlanRecipe of mealPlanRecipes) {
    const recipe = mealPlanRecipe.recipe
    if (!recipe || !recipe.ingredients) {
      continue
    }

    const portionMultiplier = mealPlanRecipe.portion_multiplier || 1
    const ingredients = recipe.ingredients || []

    for (const ingredient of ingredients) {
      // Handle different ingredient formats
      const itemName = ingredient.item || ingredient.ingredient || ''
      const quantityStr = ingredient.quantity || '0'
      
      if (!itemName) {
        continue
      }

      // Parse quantity and unit
      let baseQuantity = parseQuantity(quantityStr)
      let unit = ingredient.unit || parseUnit(quantityStr)
      
      // Apply portion multiplier
      const scaledQuantity = baseQuantity * portionMultiplier

      if (scaledQuantity <= 0) {
        continue
      }

      // Normalize unit (empty string if no unit)
      const normalizedUnit = unit || ''
      
      // Create key for aggregation (case-insensitive name + exact unit match)
      const normalizedName = normalizeIngredientName(itemName)
      const key = `${normalizedName}|${normalizedUnit}`

      // Aggregate quantities
      const existing = ingredientMap.get(key)
      if (existing) {
        existing.quantity += scaledQuantity
      } else {
        ingredientMap.set(key, {
          quantity: scaledQuantity,
          unit: normalizedUnit,
          item_name: itemName // Keep original casing for display
        })
      }
    }
  }

  // Convert map to array and sort by item name
  const groceryList: CalculatedGroceryItem[] = Array.from(ingredientMap.values())
    .map(item => ({
      item_name: item.item_name,
      quantity: item.quantity,
      unit: item.unit
    }))
    .sort((a, b) => a.item_name.localeCompare(b.item_name))

  return groceryList
}


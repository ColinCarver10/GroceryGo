import { Ingredient, RecipeIngredient } from '@/types/database';
import type { Recipe, MealPlanWithRecipes, MealPlanRecipe } from '@/types/database'

export const getIngredients = (recipe: Recipe): Ingredient[] => {
    if (!recipe.ingredients) return [];
    
    // Handle JSON array format (current format)
    if (Array.isArray(recipe.ingredients)) {
        return recipe.ingredients.map((ing: RecipeIngredient | string) => {
            // If it's already a RecipeIngredient object
            if (typeof ing === 'object' && ing !== null && 'item' in ing) {
                const recipeIng = ing as RecipeIngredient;
                // Format as "quantity item" (quantity already includes unit per prompts)
                return { ingredient: `${recipeIng.quantity} ${recipeIng.item}` };
            }
            // If it's a string (backward compatibility)
            if (typeof ing === 'string') {
                return { ingredient: ing };
            }
            return { ingredient: String(ing) };
        });
    }
    
    // Handle string format (backward compatibility)
    if (typeof recipe.ingredients === 'string') {
        try {
            // Try to parse as JSON first
            const parsed = JSON.parse(recipe.ingredients);
            if (Array.isArray(parsed)) {
                return parsed.map((ing: RecipeIngredient | string) => {
                    if (typeof ing === 'object' && ing !== null && 'item' in ing) {
                        const recipeIng = ing as RecipeIngredient;
                        return { ingredient: `${recipeIng.quantity} ${recipeIng.item}` };
                    }
                    return { ingredient: String(ing) };
                });
            }
        } catch {
            // If JSON parsing fails, fall back to old string parsing
            return parseArrayFromString(recipe.ingredients).map((i) => ({
                ingredient: i,
            }));
        }
    }
    
    return [];
};

export const getRecipeSteps = (recipe: Recipe): string[] => {
    if (!recipe.steps) return [];
    
    // Handle JSON array format (current format)
    if (Array.isArray(recipe.steps)) {
        return recipe.steps.map(step => String(step));
    }
    
    // Handle string format (backward compatibility)
    if (typeof recipe.steps === 'string') {
        try {
            // Try to parse as JSON first
            const parsed = JSON.parse(recipe.steps);
            if (Array.isArray(parsed)) {
                return parsed.map(step => String(step));
            }
        } catch {
            // If JSON parsing fails, fall back to old string parsing
            return parseArrayFromString(recipe.steps);
        }
    }
    
    return [];
};


export const parseArrayFromString = (value: string): string[] => {
  const s = value.trim();
  if (!s.startsWith("[") || !s.endsWith("]")) return [];

  const result: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let i = 1; i < s.length - 1; i++) {
    const ch = s[i];

    if (quote) {
      if (escaped) {
        current += ch;
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        result.push(current);
        current = "";
        quote = null;
      } else {
        current += ch;
      }
    } else {
      if (ch === "'" || ch === '"') {
        quote = ch;
      }
    }
  }

  return result;
};

export interface WeekDayMeals {
  date: string // YYYY-MM-DD
  dayName: string // "Monday", "Tuesday", etc.
  dayShort: string // "Mon", "Tue", etc.
  dateDisplay: string // "Jan 15" format
  breakfast: (MealPlanRecipe & { recipe: Recipe })[]
  lunch: (MealPlanRecipe & { recipe: Recipe })[]
  dinner: (MealPlanRecipe & { recipe: Recipe })[]
}

export interface OrganizedWeekMeals {
  days: WeekDayMeals[]
  unscheduled: (MealPlanRecipe & { recipe: Recipe })[]
}

/**
 * Organizes meal plan recipes by week, day, and meal type
 * Always shows all 7 days of the week, even if some have no recipes
 */
export function organizeMealsByWeek(mealPlan: MealPlanWithRecipes): OrganizedWeekMeals {
  const days: WeekDayMeals[] = []
  const unscheduled: (MealPlanRecipe & { recipe: Recipe })[] = []

  // Always generate all 7 days of the week from week_of
  const [year, month, day] = mealPlan.week_of.split('-').map(Number)
  const weekOf = new Date(year, month - 1, day)
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekOf)
    date.setDate(weekOf.getDate() + i)
    
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
    const dayShort = date.toLocaleDateString('en-US', { weekday: 'short' })
    const dateDisplay = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })

    days.push({
      date: dateStr,
      dayName,
      dayShort,
      dateDisplay,
      breakfast: [],
      lunch: [],
      dinner: []
    })
  }

  // Group recipes by date
  const recipesByDate = new Map<string, (MealPlanRecipe & { recipe: Recipe })[]>()
  
  mealPlan.meal_plan_recipes.forEach((mpr) => {
    if (!mpr.recipe) return
    
    const plannedDate = mpr.planned_for_date
    
    if (!plannedDate) {
      unscheduled.push(mpr)
      return
    }

    // Normalize date to YYYY-MM-DD format without timezone conversion
    let dateKey: string
    if (typeof plannedDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(plannedDate)) {
      // Already in YYYY-MM-DD format, just take the date part
      dateKey = plannedDate.split('T')[0].split(' ')[0]
    } else {
      // Parse the date and format it
      const [year, month, day] = plannedDate.split('T')[0].split('-').map(Number)
      const parsedDate = new Date(year, month - 1, day)
      dateKey = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`
    }
    
    if (!recipesByDate.has(dateKey)) {
      recipesByDate.set(dateKey, [])
    }
    recipesByDate.get(dateKey)!.push(mpr)
  })

  // Organize recipes into day slots by meal type
  days.forEach((day) => {
    const dayRecipes = recipesByDate.get(day.date) || []
    
    dayRecipes.forEach((mpr) => {
      const mealType = mpr.meal_type?.toLowerCase() || 'dinner'
      
      if (mealType === 'breakfast') {
        day.breakfast.push(mpr)
      } else if (mealType === 'lunch') {
        day.lunch.push(mpr)
      } else {
        day.dinner.push(mpr)
      }
    })
  })

  return { days, unscheduled }
}

import type { Recipe } from '@/types/database'
export const getIngredients = (recipe: Recipe): string[] => {
    if (!recipe.ingredients) return [];
    if (typeof recipe.ingredients === 'string') {
        let ingredients: string = recipe.ingredients; 
        return parseArrayFromString(ingredients);
    }
    return [];
};

export const getRecipeSteps = (recipe: Recipe): string[] => {
    debugger
    if (!recipe.steps) return [];
    if (typeof recipe.steps === 'string') {
        const stepsString: string = recipe.steps;
        return parseArrayFromString(stepsString);
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

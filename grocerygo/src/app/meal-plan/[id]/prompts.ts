import type { SurveyResponse } from '@/types/database'

const MEASUREMENT_UNITS_PROMPT = `
When specifying ingredient quantities, use these standardized measurement units based on Instacart's API requirements:

Volume Measurements:
- cup, cups, or c (e.g., walnuts, heavy cream, rolled oats)
- fl oz (e.g., milk, water, oil)
- gallon, gallons, gal, or gals (e.g., milk, water)
- milliliter, millilitre, milliliters, millilitres, ml, or mls (e.g., milk, juice)
- liter, litre, liters, litres, or l (e.g., water, juice)
- pint, pints, pt, or pts (e.g., ice cream)
- quart, quarts, qt, or qts (e.g., ice cream)
- tablespoon, tablespoons, tb, or tbs (e.g., oil, salt, sugar) - DO NOT use "tbsp"
- teaspoon, teaspoons, ts, tsp, or tspn (e.g., pepper, spices)

Weight Measurements:
- gram, grams, g, or gs (e.g., rice, pasta)
- kilogram, kilograms, kg, or kgs (e.g., meat, flour)
- ounce, ounces, or oz (e.g., cereal, butter)
- pound, pounds, lb, or lbs (e.g., meat, flour)

Countable Items:
- bunch or bunches (e.g., carrots, beets)
- can or cans (e.g., corn, beans)
- each (e.g., tomatoes, onions, garlic cloves) - Use for individual items
- ears (e.g., corn)
- head or heads (e.g., lettuce)
- large, lrg, lge, or lg (e.g., eggs, avocados)
- medium, med, or md (e.g., eggs, avocados)
- package or packages (e.g., meat)
- packet (e.g., scones)
- small or sm (e.g., eggs, avocados)

Container Types:
- container (e.g., berries, prepared meals)
- jar (e.g., oil, broth)
- pouch (e.g., baby food)
- bag (e.g., produce)
- box (e.g., cereal)

Important Rules:
1. For countable items (like tomatoes, onions), use "each" rather than weight
2. For garlic cloves, use "each" as the unit (e.g., "4 each garlic cloves") - DO NOT use "cloves" as a unit
3. Use the most appropriate unit for the ingredient (e.g., "2 cups milk" not "16 fl oz milk")
4. Be consistent with units throughout the recipe
5. ONLY use abbreviations from the list above (e.g., "tbs" or "tb" for tablespoon, NEVER "tbsp")
6. Include both quantity and unit in the format: "quantity unit" (e.g., "2 cups", "1 lb", "3 each")
`;

export const replaceRecipePrompt = (
  surveyData: SurveyResponse,
  mealType: string,
  existingIngredients: string[],
  recipeToReplace: string
) => {
  // Extract favored and excluded ingredients from questions '12' and '13'
  // Fall back to old fields for backward compatibility
  const favoredIngredients = (surveyData['12'] || surveyData.favored_ingredients || []) as string[]
  const excludedIngredients = (surveyData['13'] || surveyData.excluded_ingredients || []) as string[]
  
  let ingredientPreferencesSection = ''
  if (favoredIngredients.length > 0 || excludedIngredients.length > 0) {
    ingredientPreferencesSection = '\n### Ingredient Preferences:\n'
    
    if (favoredIngredients.length > 0) {
      ingredientPreferencesSection += `**Favored Ingredients (prioritize using these):** ${favoredIngredients.join(', ')}\n`
    }
    
    if (excludedIngredients.length > 0) {
      ingredientPreferencesSection += `**Excluded Ingredients (NEVER use these):** ${excludedIngredients.join(', ')}\n`
    }
  }
  
  // Check if protein requirement applies
  const goals = surveyData['9'] || []
  const priorities = surveyData['11'] || []
  const requiresProtein = goals.includes('Eat healthier') || priorities[0] === 'Nutrition'
  
  // Check if budget-conscious
  const budgetResponse = surveyData['3'] || ''
  const isBudgetConscious = goals.includes('Save money on groceries') || budgetResponse === '$50-100' || priorities[0] === 'Cost efficiency' || priorities[1] === 'Cost efficiency'
  
  let proteinRequirement = ''
  if (requiresProtein) {
    proteinRequirement = `\n### Protein Requirement:
- **TARGET: 0.5 lb (8 oz) protein TOTAL per recipe** (not per serving)
- Animal: chicken, turkey, beef, pork, fish, seafood, eggs, Greek yogurt, cottage cheese
- Plant: tofu, tempeh, legumes, quinoa, nuts, seeds
${isBudgetConscious ? `- Budget proteins: chicken thighs, ground beef/turkey, pork shoulder, canned tuna, eggs, beans/lentils, tofu (avoid ribeye, salmon, shrimp, lamb)` : ''}\n`
  }
  
  return `You are an expert meal planner generating a single replacement recipe.

### Context:
The user wants to replace the recipe "${recipeToReplace}" with a new ${mealType} recipe.

### User Preferences:
${JSON.stringify(surveyData, null, 2)}
${ingredientPreferencesSection}${proteinRequirement}
### Existing Ingredients in Meal Plan:
${existingIngredients.join(', ')}

### Requirements:
1. Generate EXACTLY 1 ${mealType} recipe
2. Follow all dietary restrictions and preferences from the user data
3. NEVER use any excluded ingredients
4. Prioritize using favored ingredients when appropriate
5. Try to reuse ingredients from the existing meal plan when possible
6. Match the user's skill level and time constraints
7. Different from "${recipeToReplace}" - don't generate similar recipes
8. ${requiresProtein ? 'MANDATORY: Include a good quality protein source (see Protein Requirement above)' : 'Include appropriate protein if suitable for the meal type'}

### Measurement Units:
${MEASUREMENT_UNITS_PROMPT}

### Output Format (JSON only, no explanation):
{
  "recipe": {
    "name": "Recipe Name",
    "ingredients": [
      { "item": "Ingredient Name", "quantity": "Amount + Unit" }
    ],
    "steps": [
      "Step 1",
      "Step 2"
    ]
  },
  "additional_grocery_items": [
    { "item": "Ingredient Name", "quantity": "Amount + Unit" }
  ]
}

Note: additional_grocery_items should only include NEW ingredients not in the existing list.`;
};

export const replaceRecipeWithTotalIngredientsPrompt = (
  surveyData: SurveyResponse,
  mealType: string,
  recipeToReplace: string,
  oldRecipeIngredients: Array<{ item: string; quantity: string }>,
  currentTotalIngredients: Array<{ item: string; quantity: string }> | { items: Array<{ item: string; quantity: string }>; seasonings: Array<{ item: string; quantity: string }> },
  candidateRecipe?: any
) => {
  // Extract favored and excluded ingredients from questions '12' and '13'
  // Fall back to old fields for backward compatibility
  const favoredIngredients = (surveyData['12'] || surveyData.favored_ingredients || []) as string[]
  const excludedIngredients = (surveyData['13'] || surveyData.excluded_ingredients || []) as string[]
  
  let ingredientPreferencesSection = ''
  if (favoredIngredients.length > 0 || excludedIngredients.length > 0) {
    ingredientPreferencesSection = '\n### Ingredient Preferences:\n'
    
    if (favoredIngredients.length > 0) {
      ingredientPreferencesSection += `**Favored Ingredients (prioritize using these):** ${favoredIngredients.join(', ')}\n`
    }
    
    if (excludedIngredients.length > 0) {
      ingredientPreferencesSection += `**Excluded Ingredients (NEVER use these):** ${excludedIngredients.join(', ')}\n`
    }
  }
  
  // Check if protein requirement applies
  const goals = surveyData['9'] || []
  const priorities = surveyData['11'] || []
  const requiresProtein = goals.includes('Eat healthier') || priorities[0] === 'Nutrition'
  
  // Check if budget-conscious
  const budgetResponse = surveyData['3'] || ''
  const isBudgetConscious = goals.includes('Save money on groceries') || budgetResponse === '$50-100' || priorities[0] === 'Cost efficiency' || priorities[1] === 'Cost efficiency'
  
  let proteinRequirement = ''
  if (requiresProtein) {
    proteinRequirement = `\n### Protein Requirement:
- **TARGET: 0.5 lb (8 oz) protein TOTAL per recipe** (not per serving)
- Animal: chicken, turkey, beef, pork, fish, seafood, eggs, Greek yogurt, cottage cheese
- Plant: tofu, tempeh, legumes, quinoa, nuts, seeds
${isBudgetConscious ? `- Budget proteins: chicken thighs, ground beef/turkey, pork shoulder, canned tuna, eggs, beans/lentils, tofu (avoid ribeye, salmon, shrimp, lamb)` : ''}\n`
  }
  
  let candidateRecipeSection = ''
  if (candidateRecipe) {
    candidateRecipeSection = `\n### Candidate Recipe (base to modify):
${JSON.stringify(candidateRecipe, null, 2)}

**IMPORTANT**: You MUST modify this candidate recipe to align with user goals, just like the original meal plan generation does. Do NOT use it as-is.`
  }

  return `You are an expert meal planner generating a single replacement recipe and updating the total ingredients list.

### Context:
The user wants to replace the recipe "${recipeToReplace}" with a new ${mealType} recipe.

### User Preferences:
${JSON.stringify(surveyData, null, 2)}
${ingredientPreferencesSection}${proteinRequirement}${candidateRecipeSection}

### Old Recipe Ingredients (to be removed):
${JSON.stringify(oldRecipeIngredients, null, 2)}

### Current Total Ingredients List:
${JSON.stringify(currentTotalIngredients, null, 2)}

**Note**: The total ingredients list may be in one of two formats:
- Old format: Array of items [{item: "...", quantity: "..."}, ...]
- New format: Object with items and seasonings arrays {items: [...], seasonings: [...]}
If you receive the old format, convert it to the new format by placing all items in items and an empty seasonings array.

### Requirements:
1. Generate EXACTLY 1 ${mealType} recipe that:
   ${candidateRecipe ? '- MODIFY the provided candidate recipe to align with user goals (do NOT use it as-is)' : '- Create a new recipe'}
   - Follows all dietary restrictions and preferences from the user data
   - NEVER uses any excluded ingredients
   - Prioritizes using favored ingredients when appropriate
   - Matches the user's skill level and time constraints
   - Is different from "${recipeToReplace}" - don't generate similar recipes
   - ${requiresProtein ? 'MANDATORY: Includes a good quality protein source (see Protein Requirement above)' : 'Includes appropriate protein if suitable for the meal type'}
   - Aligns with user goals (cost efficiency, nutrition, time saving, etc.)
   ${candidateRecipe ? '- For cost efficiency goals: Modify to consolidate ingredients with the current_total_ingredients list when possible' : ''}

2. Update the Total Ingredients List:
   - Separate main ingredients from seasonings:
     * Seasonings include: salt, pepper, spices (cayenne, paprika, cumin, turmeric, etc.), dried herbs (oregano, basil, thyme, etc.), spice blends, garlic powder, onion powder, etc.
     * Main ingredients are everything else (produce, meat, dairy, grains, etc.)
   - **IMPORTANT**: Do NOT include water in the grocery list. Water is assumed to be available and should not be listed as an ingredient.
   - Remove ingredients from the old recipe (subtract quantities from the appropriate array: items or seasonings)
   - Add ingredients from the new recipe (add quantities to the appropriate array: items or seasonings)
   - CONSOLIDATE ingredients within each array: If the same ingredient appears multiple times with the same unit, sum the quantities
   - If the same ingredient appears with different units, keep them separate
   - Use consistent ingredient names (match existing names when possible)
   - Ensure all quantities have valid units
   - Maintain separation: items stay in items array, seasonings stay in seasonings array

### Measurement Units:
${MEASUREMENT_UNITS_PROMPT}

### Output Format (JSON only, no explanation):
{
  "recipe": {
    "name": "Recipe Name",
    "ingredients": [
      { "item": "Ingredient Name", "quantity": "Amount + Unit" }
    ],
    "steps": [
      "Step 1",
      "Step 2"
    ]
  },
  "updated_total_ingredients": {
    "items": [
      { "item": "Ingredient Name", "quantity": "Total Amount + Unit" }
    ],
    "seasonings": [
      { "item": "Spice/Seasoning Name", "quantity": "Total Amount + Unit" }
    ]
  }
}

### Critical Rules for updated_total_ingredients:
**IMPORTANT - Quantity Calculation:**
- Recipe ingredients show quantities for ONE serving (e.g., "0.5 lb chicken")
- When adding to total, MULTIPLY recipe quantities by servings
- Example: Recipe has "0.5 lb chicken" with 4 servings → add 2 lb to total

1. Start with the current_total_ingredients list (convert to new format if needed)
2. For each ingredient in old_recipe_ingredients (multiply by old recipe servings):
   - Subtract the calculated quantity from the current quantity
   - If result is 0 or negative, remove from list
3. For each ingredient in new recipe (multiply by new recipe servings):
   - If found, add the calculated quantity to existing
   - If not found, add as new ingredient
4. Sort each array alphabetically
5. Use EXACT same ingredient names as in current_total_ingredients
6. Always return the new format: {items: [...], seasonings: [...]}`;
};

export const bulkAdjustmentPrompt = (
  surveyData: SurveyResponse,
  adjustments: {
    reduceTime?: boolean
    lowerBudget?: boolean
    minimizeIngredients?: boolean
  },
  totalMeals: number,
  mealBreakdown: { breakfast: number; lunch: number; dinner: number }
) => {
  const adjustmentInstructions = []
  
  if (adjustments.reduceTime) {
    adjustmentInstructions.push('- Prioritize recipes that take 30 minutes or less')
    adjustmentInstructions.push('- Favor simple cooking techniques and minimal prep')
  }
  
  if (adjustments.lowerBudget) {
    adjustmentInstructions.push('- Use budget-friendly ingredients (chicken thighs instead of breasts, canned beans, etc.)')
    adjustmentInstructions.push('- Maximize ingredient reuse across recipes')
    adjustmentInstructions.push('- Avoid expensive or specialty ingredients')
  }
  
  if (adjustments.minimizeIngredients) {
    adjustmentInstructions.push('- Limit total unique ingredients to 15-20 items maximum')
    adjustmentInstructions.push('- Reuse the same ingredients across multiple recipes')
    adjustmentInstructions.push('- Focus on pantry staples')
  }

  // Extract favored and excluded ingredients
  const favoredIngredients = surveyData.favored_ingredients as string[] || []
  const excludedIngredients = surveyData.excluded_ingredients as string [] || []
  
  let ingredientPreferencesSection = ''
  if (favoredIngredients.length > 0 || excludedIngredients.length > 0) {
    ingredientPreferencesSection = '\n### Ingredient Preferences:\n'
    
    if (favoredIngredients.length > 0) {
      ingredientPreferencesSection += `**Favored Ingredients (prioritize using these):** ${favoredIngredients.join(', ')}\n`
    }
    
    if (excludedIngredients.length > 0) {
      ingredientPreferencesSection += `**Excluded Ingredients (NEVER use these):** ${excludedIngredients.join(', ')}\n`
    }
  }

  // Check if protein requirement applies
  const goals = surveyData['9'] || []
  const priorities = surveyData['11'] || []
  const requiresProtein = goals.includes('Eat healthier') || priorities[0] === 'Nutrition'
  
  // Check if budget-conscious
  const budgetResponse = surveyData['3'] || ''
  const isBudgetConscious = goals.includes('Save money on groceries') || budgetResponse === '$50-100' || priorities[0] === 'Cost efficiency' || priorities[1] === 'Cost efficiency'
  
  let proteinRequirement = ''
  if (requiresProtein) {
    proteinRequirement = `\n### Protein Requirement:
- **TARGET: 0.5 lb (8 oz) protein TOTAL per recipe** (not per serving)
- Animal: chicken, turkey, beef, pork, fish, seafood, eggs, Greek yogurt, cottage cheese
- Plant: tofu, tempeh, legumes, quinoa, nuts, seeds
${isBudgetConscious ? `- Budget proteins: chicken thighs, ground beef/turkey, pork shoulder, canned tuna, eggs, beans/lentils, tofu (avoid ribeye, salmon, shrimp, lamb)` : ''}\n`
  }

  /**
   * NOTE FOR FUTURE IMPROVEMENTS:
   *   1. Add a validation checklist in the prompt so GPT confirms both recipes & schedule sections were produced.
   *   2. Consider switching regenerateWithAdjustments to callOpenAIStructured with a schema that requires schedule entries.
   *   3. Extend server-side fallback/repair logic so downstream inserts always receive a complete schedule even if GPT skips it.
   */
  return `You are an expert meal planner regenerating a complete meal plan with specific optimizations.

### User Preferences:
${JSON.stringify(surveyData, null, 2)}
${ingredientPreferencesSection}${proteinRequirement}
### Special Optimizations to Apply:
${adjustmentInstructions.join('\n')}

### Requirements:
1. Generate exactly ${totalMeals} recipes:
   - ${mealBreakdown.breakfast} breakfast meals
   - ${mealBreakdown.lunch} lunch meals
   - ${mealBreakdown.dinner} dinner meals
2. Follow all dietary restrictions from user preferences
3. NEVER use any excluded ingredients
4. Prioritize using favored ingredients when appropriate
5. Apply ALL optimization constraints listed above
6. Label each recipe with appropriate meal_type
7. ${requiresProtein ? 'MANDATORY: Every recipe MUST include a good quality protein source (see Protein Requirement above)' : 'Include appropriate protein in recipes where suitable'}

### Measurement Units:
${MEASUREMENT_UNITS_PROMPT}

### Output Format (JSON only, no explanation):
{
  "recipes": [
    {
      "name": "Recipe Name",
      "mealType": "Breakfast | Lunch | Dinner",
      "ingredients": [
        { "item": "Ingredient Name", "quantity": "Amount + Unit" }
      ],
      "steps": [
        "Step 1",
        "Step 2"
      ]
    }
  ],
  "grocery_list": [
    { "item": "Ingredient Name", "quantity": "Total Amount + Unit" }
  ]
}

**CRITICAL - Grocery List Quantity Calculation:**
- Recipe ingredients show quantities for ONE serving (e.g., "0.5 lb chicken")
- Grocery list must MULTIPLY recipe quantities by servings to get total needed
- Example: Recipe has "0.5 lb chicken" with 4 servings → grocery list shows "2 lb chicken"

**Important**: Every recipe MUST include a "mealType" field indicating the type of meal (Breakfast, Lunch, or Dinner).`;
};

export const swapIngredientPrompt = (
  ingredientName: string,
  recipeName: string,
  recipeContext: string
) => `You are a culinary expert suggesting ingredient substitutions.

### Context:
Recipe: "${recipeName}"
Current Ingredient: "${ingredientName}"
Recipe Type: ${recipeContext}

### Task:
Suggest 3-5 alternative ingredients that could replace "${ingredientName}" in this recipe.
Consider: allergies, availability, cost, and maintaining the recipe's flavor profile.

### Output Format (JSON only):
{
  "suggestions": [
    {
      "ingredient": "Alternative Ingredient Name",
      "reason": "Why this works as a substitute",
      "quantity_adjustment": "1:1 ratio" or "Use 2x amount" etc.
    }
  ]
}`;

export const simplifyRecipePrompt = (
  recipeName: string,
  ingredients: Array<{ item: string; quantity: string }>,
  steps: string[]
) => `You are a meal planning expert helping busy people cook more efficiently.

### Current Recipe: "${recipeName}"

### Current Ingredients:
${ingredients.map(ing => `- ${ing.quantity} ${ing.item}`).join('\n')}

### Current Steps:
${steps.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}

### Task:
Simplify this recipe by:
1. Suggesting store-bought alternatives for complex components
2. Reducing the number of steps where possible
3. Using pre-prepped ingredients (rotisserie chicken, pre-cut vegetables, jarred sauces, etc.)
4. Maintaining the core flavor and dish concept

### Output Format (JSON only):
{
  "simplified_recipe": {
    "name": "${recipeName} (Simplified)",
    "ingredients": [
      { "item": "Ingredient (can be store-bought)", "quantity": "Amount + Unit" }
    ],
    "steps": [
      "Simplified step 1",
      "Simplified step 2"
    ]
  },
  "time_saved": "Estimated time savings",
  "changes_made": "Brief description of simplifications"
}`;

export { MEASUREMENT_UNITS_PROMPT };


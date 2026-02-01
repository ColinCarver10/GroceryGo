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

const mealPlanFromSurveyPrompt = (surveyData: SurveyResponse) => {
  // Extract survey data with fallbacks
  const goals = (surveyData['9'] || []) as string[]
  const priorities = (surveyData['11'] || []) as string[]
  const flavors = (surveyData['8'] || []) as string[]
  const budgetResponse = (surveyData['3'] || '') as string
  
  // Determine which sections to include
  const requiresProtein = goals.includes('Eat healthier') || priorities[0] === 'Nutrition'
  const hasPriorities = Array.isArray(priorities) && priorities.length > 0
  const hasFlavors = Array.isArray(flavors) && flavors.length > 0
  const hasGoals = Array.isArray(goals) && goals.length > 0
  const isBudgetConscious = goals.includes('Save money on groceries') || budgetResponse === '$50-100' || priorities[0] === 'Cost efficiency' || priorities[1] === 'Cost efficiency'
  
  // Build protein requirements section conditionally
  let proteinRequirementsSection = ''
  if (isBudgetConscious) {
    // Always show budget-friendly protein options when budget-conscious
    proteinRequirementsSection = `### Protein Requirements:
${requiresProtein ? '- EVERY recipe MUST include a quality protein source\n' : ''}- **TARGET: ${requiresProtein ? '0.5 lbs (8 oz)' : '0.25 lbs (4 oz)'} protein per serving**
- **BUDGET-FRIENDLY PROTEIN OPTIONS (use these):**
  - **Animal proteins:** chicken thighs/drumsticks, ground beef/turkey (80/20 or leaner), pork shoulder/butt, canned tuna, eggs, whole chicken
  - **Plant proteins (most cost-effective):** beans/lentils/chickpeas, black beans, kidney beans, pinto beans, tofu
  - **Breakfast:** eggs, Greek yogurt (store brand), cottage cheese, peanut butter
- **NEVER USE when budget-conscious:** salmon, shrimp, lobster, crab, ribeye steak, filet mignon, lamb, premium cuts, fresh tuna, swordfish, or any seafood/fish over $8/lb
- **Cost-saving strategy:** It's acceptable to use the same protein source across multiple meals (e.g., use chicken thighs in 3-4 meals) to maximize cost efficiency
`
  } else if (requiresProtein) {
    // Show regular protein requirements when protein is required but not budget-conscious
    proteinRequirementsSection = `### Protein Requirements:
- EVERY recipe MUST include a quality protein source
- **TARGET: 0.5 lbs (8 oz) protein per serving**
- Animal: chicken, turkey, beef, pork, fish/seafood, eggs, Greek yogurt, cottage cheese
- Plant: tofu, tempeh, beans/lentils/chickpeas, quinoa, nuts, seeds
- Breakfast: eggs, Greek yogurt, cottage cheese, protein powder, nut butters
`
  }
  
  // Build user priorities section conditionally
  let userPrioritiesSection = ''
  if (hasPriorities) {
    userPrioritiesSection = `### User Priorities (Question 11) — follow ranked order:
- If Cost efficiency is #1:
  - CRITICAL: MODIFY ALL recipes to CONSOLIDATE ingredients. When multiple recipes need similar items, modify them to use the EXACT SAME ingredients.
  - Examples: If one recipe uses bell peppers and another uses different vegetables, modify both to use bell peppers. If one uses chicken and another uses beef, consider modifying both to use the same protein source.
  - Maximize ingredient reuse across ALL recipes to reduce unique grocery items
  - Update recipes to use overlapping ingredients and pantry staples
  - The goal is to minimize the number of unique ingredients in the grocery list by consolidating across recipes
- If Nutrition is #1:
  - MODIFY recipes to use whole foods, veggies, lean proteins; replace overly processed choices
  - Protein requirement becomes mandatory (see above)
- If Time saving is #1:
  - MODIFY recipes to use simpler cooking methods, fewer steps
  - Update recipes to use shortcuts: rotisserie chicken, bagged salad, frozen veg, jarred sauces

`
  }
  
  // Build flavors section conditionally
  let flavorsSection = ''
  if (hasFlavors) {
    flavorsSection = `### Flavors (Question 8):
When modifying recipes, adjust flavors to match requested preferences (Savory/Spicy/Sweet/etc.) without violating exclusions. Add spices, seasonings, or flavor components as needed.

`
  }
  
  // Build goals section conditionally
  let goalsSection = ''
  if (hasGoals) {
    goalsSection = `### Goals (Question 9):
- Eat healthier: MODIFY recipes to include mandatory protein + healthier choices (replace processed items with whole foods)
- Learn new recipes: MODIFY 1–2 recipes to include a slightly new technique (still within skill/time constraints)
- Save money: MODIFY recipes to maximize ingredient reuse + use low-cost ingredients; CONSOLIDATE ingredients across ALL recipes (modify recipes to use the same ingredients where possible to reduce grocery costs)
- Reduce waste: MODIFY recipes to use ingredients fully across multiple recipes (ensure shared ingredients are used completely)

`
  }
  
  // Build validation checklist with conditional protein requirement
  let validationChecklist = `### Validation Checklist (must satisfy before output):
1) schedule length === meal_slots length (every slot filled)
2) Every schedule.recipeId exists in recipes[].id
3) No excluded ingredients appear in any modified recipe
4) Units comply with Measurement Units rules (no tbsp)
${requiresProtein ? '5) Protein requirement satisfied for every recipe when triggered (recipes must be modified to include quality protein sources)' : ''}
${requiresProtein ? '6' : '5'}) Recipes are modified to align with user goals:
   - If cost efficiency/save money: ingredients are consolidated across recipes (same ingredients used in multiple recipes)
   ${requiresProtein ? '- If nutrition/eat healthier: quality protein sources are present in all recipes' : ''}
   - All other goals are addressed through modifications
${requiresProtein ? '7' : '6'}) ALL provided recipes are used and modified (one distinct modified recipe per provided recipe)
${requiresProtein ? '8' : '7'}) **INGREDIENT CONSOLIDATION VERIFIED:**
   - All recipes use consistent ingredient names (no variations like "egg" vs "eggs" or "chicken" vs "chicken breast")
   - Grocery list uses exact same ingredient names as recipes
   - Grocery list has no duplicate entries for the same ingredient (quantities are summed)
   - Pluralization is consistent (always plural for countable items)
`
  
  return `You are an expert meal planner. Build a personalized meal plan by MODIFYING provided recipes to align with user goals, then scheduling them.

You MAY reuse the same recipe across multiple meal slots (duplicate recipes across the schedule is allowed and encouraged when it supports budget/time/ingredient reuse), but you must still follow all restrictions.

### Input:
You will be given:
1) user_survey (same schema as the example below)
   - Question '12' contains favored ingredients (Foods You Like)
   - Question '13' contains excluded ingredients (Foods You Dislike)
4) meal_slots: an array of requested schedule slots (day + mealType) that MUST be filled
5) provided_recipes: exactly ONE recipe for each distinct meal type (e.g., if there are 2 distinct breakfasts needed, you'll receive 2 breakfast recipes; if 2 distinct lunches, you'll receive 2 lunch recipes, etc.). You MUST modify and use ALL provided recipes.

### user_survey format example:
{
  "1": "25-34",
  "2": "5+ people",
  "3": "$50-100",
  "4": "Intermediate (Comfortable with most recipes)",
  "5": "Quick (15-30 minutes)",
  "6": ["No restrictions"],
  "7": ["None"],
  "8": ["Savory", "Spicy", "Sweet"],
  "9": ["Eat healthier", "Learn new recipes", "Save money on groceries", "Reduce food waste"],
  "11": ["Cost efficiency", "Nutrition", "Time saving"]
}

### Your Task:
Using the provided_recipes (one per distinct meal type):
1) MODIFY each recipe to align with user goals and preferences:
   ${requiresProtein ? '- For high protein goals: Ensure EVERY recipe includes a quality protein source. If a recipe lacks protein, ADD a quality protein source (e.g., chicken, fish, tofu, beans, eggs, Greek yogurt) that fits the dish.' : ''}
   - For cost efficiency goals: CONSOLIDATE ingredients across ALL recipes. Modify recipes to use the same ingredients where possible (e.g., if multiple recipes need vegetables, use the same vegetables; if multiple recipes need proteins, sometimes swap expensive protein source, but not always). This reduces grocery costs by maximizing ingredient reuse.
   - Adjust quantities, swap ingredients, or add/remove components as needed to meet goals
   - Remove or replace any excluded ingredients
   - Ensure ingredients have valid quantities + units
   - Ensure steps are clear (4–10 steps)
2) Schedule the modified recipes across ALL meal_slots (you may reuse the same modified recipe across multiple slots).
3) Produce:
   - recipes[] (all unique modified recipes, one per distinct meal type from provided_recipes)
   - schedule[] (one entry per requested meal slot)
   - grocery_list{} (consolidated totals with items and seasonings separated)

### Hard Rules (must follow):
A) Do NOT invent new recipes. Every recipe MUST be based on a provided_recipes entry. You MUST modify ALL provided recipes to align with user goals.
B) Do NOT include any excluded ingredients (Question '13' - Foods You Dislike). If a provided recipe includes an excluded ingredient, you MUST remove or replace it.
C) Respect dietary restrictions (Question 6) and allergies (Question 7). Modify recipes to comply with all restrictions.
D) Fill EVERY meal slot in meal_slots with a schedule entry.
E) schedule.recipeId MUST reference an id in recipes[].
F) All recipes MUST include: id, name, mealType, servings, ingredients, steps.
G) Follow Measurement Units rules exactly (no "tbsp"; use "tbs" or "tb").
H) You MUST use ALL provided recipes. Each provided recipe becomes one distinct recipe in your output (modified to align with goals).

### Household Size (Question 2) - Servings per Meal:
Based on user's household size from Question 2, set portionMultiplier for each schedule entry:
- "Just me" → portionMultiplier = 1 (1 serving per meal)
- "2 people" → portionMultiplier = 2 (2 servings per meal)
- "3-4 people" → portionMultiplier = 3 (3 servings per meal)
- "5+ people" → portionMultiplier = 4 (4 servings per meal)

IMPORTANT: 
- Each schedule entry's portionMultiplier should reflect servings needed for that specific meal slot based on household size.
- When modifying recipes, you MUST adjust ingredient quantities to match the serving size. The provided recipes may have different serving sizes - you need to scale all ingredients proportionally to match the target serving size. Maintain ingredient ratios when scaling.
- Do NOT simply multiply all recipes by the same factor. Adjust each recipe's ingredients to match the appropriate serving size for the household.

${proteinRequirementsSection}### Ingredient Quantity Sanity Check:
Before finalizing, verify each ingredient quantity makes sense for ONE serving:
- Vegetables: 1-3 pieces per serving (e.g., 1 tomato, not 4)
- Aromatics: reasonable amounts (2-3 garlic cloves, not 8)
- If a quantity seems excessive for one person to eat, reduce it

${userPrioritiesSection}### Budget Guidance (Question 3):
- "$50-100": MODIFY recipes to use low-cost ingredients + heavy ingredient reuse; CONSOLIDATE ingredients across ALL recipes to keep unique ingredients low (e.g., use the same vegetables, proteins, and pantry staples across multiple recipes)
- "$101-200": moderate flexibility; still modify for ingredient reuse when possible
- "$200+": flexible, but modify to avoid unnecessary specialty items

### Skill Level (Question 4):
- Beginner: MODIFY recipes to use simple steps, minimal technique
- Intermediate: moderate complexity ok (may need minor modifications)
- Advanced: complex techniques ok (minimal modifications needed)

### Time Constraint (Question 5):
- Quick (15–30 min): MODIFY recipes to be quick; reduce prep time, simplify steps
- Standard (30–45 min): moderate ok (may need minor time-saving modifications)
- Extended (45+ min): complex ok (minimal modifications needed)

${flavorsSection}${goalsSection}### Measurement Units:
${MEASUREMENT_UNITS_PROMPT}

---

### Output Format (JSON only, no explanation):
{
  "recipes": [
    {
      "id": "provided_recipe_id",
      "name": "Recipe Name",
      "mealType": "Breakfast | Lunch | Dinner",
      "servings": 4,
      "ingredients": [
        { "item": "Ingredient Name", "quantity": "Amount + Unit" }
      ],
      "steps": [
        "Step 1",
        "Step 2"
      ]
    }
  ],
  "schedule": [
    {
      "slotLabel": "Monday Lunch",
      "day": "Monday",
      "mealType": "Lunch",
      "recipeId": "provided_recipe_id",
      "portionMultiplier": 1  // Set based on household size (Question 2): "Just me"=1, "2 people"=2, "3-4 people"=3, "5+ people"=4
    }
  ],
  "grocery_list": {
    "items": [
      { "item": "Ingredient Name", "quantity": "Total Amount + Unit" }
    ],
    "seasonings": [
      { "item": "Spice/Seasoning Name", "quantity": "Total Amount + Unit" }
    ]
  }
}

### Grocery List Structure:
- **items**: Main ingredients (produce, meat, dairy, grains, etc.) - everything that is NOT a seasoning
- **seasonings**: Spices, herbs, and seasonings (salt, pepper, spices, dried herbs, spice blends, garlic/onion powder)

**CRITICAL - Grocery List Quantity Calculation:**
- Recipe ingredients show quantities for ONE serving (e.g., "0.5 lb chicken")
- Grocery list must MULTIPLY recipe quantities by servings to get total needed
- Example: Recipe A has "0.5 lb chicken" with 3 servings, Recipe B has "0.5 lb chicken" with 4 servings
  → Grocery list should show: "3.5 lb chicken" (0.5×3 + 0.5×4)

**IMPORTANT**: Do NOT include water in the grocery list.

### CRITICAL: Ingredient Consolidation and Naming Rules

You MUST consolidate and standardize ingredient names across ALL recipes and the grocery list:

1. **Use consistent ingredient names:**
   - ALWAYS use the same name for the same ingredient across all recipes
   - Use plural forms consistently (e.g., always "eggs" not "egg", always "tomatoes" not "tomato")
   - Use standard names without unnecessary descriptors (e.g., use "chicken breast" consistently, not "boneless chicken breast" in one place and "chicken" in another)
   - Examples of correct consolidation:
     - ✅ "chicken breast" (used consistently everywhere)
     - ✅ "eggs" (always plural)
     - ✅ "tomatoes" (always plural)
     - ❌ "chicken breast", "boneless chicken breast", "chicken" (inconsistent)
     - ❌ "egg" and "eggs" (inconsistent pluralization)

2. **Consolidate similar ingredients:**
   - If multiple recipes use the same ingredient with slight variations, use ONE standard name
   - Examples:
     - "chicken breast", "boneless chicken breast", "skinless chicken breast" → consolidate to "chicken breast"
     - "egg", "eggs", "large eggs" → consolidate to "eggs"
     - "tomato", "tomatoes", "fresh tomatoes" → consolidate to "tomatoes"
     - "onion", "yellow onion", "onions" → consolidate to "onions"

3. **Grocery list consolidation:**
   - The grocery_list MUST consolidate all ingredients from all recipes
   - Use the SAME standardized ingredient names from the recipes
   - Sum quantities for the same ingredient (e.g., if Recipe 1 uses "2 cups eggs" and Recipe 2 uses "1 cup eggs", grocery list should have "3 cups eggs" not separate entries)
   - DO NOT create separate entries for the same ingredient with different names

4. **Before finalizing, verify:**
   - All recipes use consistent ingredient names (no variations of the same ingredient)
   - Grocery list uses the exact same ingredient names as recipes
   - Grocery list has consolidated quantities (no duplicate entries for the same ingredient)
   - Pluralization is consistent (always plural for countable items like eggs, tomatoes, onions)

${validationChecklist}`
}

const embeddingSentencePrompt = `You are generating a semantic search query for a recipe database.

Input:
A user survey containing goals, preferences, constraints, favorite ingredients and disliked ingredients
A meal type (breakfast, lunch, dinner)

Task:
Summarize the user’s preferences into a short, concrete food-focused phrase (8–15 words) that will be used for vector similarity search.

Rules:
Focus on ingredients, meal type, and goals
Prefer favored ingredients when possible
Do not mention allergies, time limits, or nutrition numbers (those are handled by filters)
Avoid full sentences, explanations, or fluff
Use lowercase
Output only the phrase

Examples:
Input:
{
  "goals": ["high protein", "easy meals"],
  "meal_type": "breakfast",
  "favored_ingredients": ["eggs", "cheese", "spinach"],
  "dislikes": ["mushrooms"]
}
Output:
high protein breakfast with eggs cheese and spinach

Input:
{
  "goals": ["healthy", "filling"],
  "meal_type": "dinner",
  "favored_ingredients": ["chicken", "rice", "broccoli"]
}
Output:
healthy filling chicken dinner with rice and broccoli

Input:

{
  "goals": ["low carb"],
  "meal_type": "lunch",
  "favored_ingredients": ["salmon", "avocado"]
}
Output:
low carb salmon lunch with avocado

** Output:
A single concise search phrase.`

const embeddingPromptsSystemPrompt = `You are generating semantic search queries for a recipe database.

Your task is to create three concise, food-focused phrases (one for each meal type) that will be used for vector similarity search.

Rules for each phrase:
- 8-15 words in length
- Focus on ingredients, meal type, and goals from the user survey
- Prefer favored ingredients when possible
- Do not mention allergies, time limits, or nutrition numbers (those are handled by filters)
- Avoid full sentences, explanations, or fluff
- Use lowercase
- Be concrete and food-focused

You must return your response as a valid JSON object with exactly three fields: "breakfast", "lunch", and "dinner". Each field should contain a single string phrase.`;

const embeddingPromptsUserPromptTemplate = (surveyData: any) => `${embeddingSentencePrompt}

User Survey: ${JSON.stringify(surveyData, null, 2)}

Generate three embedding prompts:
1. Breakfast - focus on breakfast preferences, favored ingredients, and goals
2. Lunch - focus on lunch preferences, favored ingredients, and goals  
3. Dinner - focus on dinner preferences, favored ingredients, and goals

Each prompt should be a single concise phrase (8-15 words) optimized for semantic recipe search.

Return your response as a JSON object with this exact structure:
{
  "breakfast": "your breakfast phrase here",
  "lunch": "your lunch phrase here",
  "dinner": "your dinner phrase here"
}

Return ONLY the JSON object, no other text or explanation. Do not include 'JSON' or extra quotes. Begin and end your resonse with { and } respectively.`;

const multipleEmbedPromptsSystemPrompt = `You are generating diverse semantic search queries for a recipe database.

Your task is to create multiple unique, food-focused phrases for each meal type that will be used for vector similarity search. Each phrase must be DISTINCTLY different to ensure recipe diversity.

CRITICAL DIVERSITY RULES:
- Balance primary proteins/ingredients across prompts - distribute them evenly (e.g., if 7 prompts: 3 chicken, 3 beef, 1 shrimp)
- It's okay to repeat the same main ingredient, but distribute it across multiple prompts rather than using it in every prompt
- Rotate through different favored ingredients - distribute them across prompts rather than using the same ones in every prompt
- Vary cooking methods (grilled, baked, stir-fried, roasted, steamed, sautéed, etc.) - even when using the same protein, use different methods
- Vary cuisine types when possible (Italian, Asian, Mexican, Mediterranean, American, etc.)
- Vary vegetable combinations - use different vegetables with the same protein
- Vary flavor profiles (spicy, savory, sweet, tangy, herby, etc.) - use different flavors even with the same protein
- Each prompt should feel distinct through different combinations of cooking method, cuisine, vegetables, or flavors

Rules for each phrase:
- 8-15 words in length
- Focus on ingredients, meal type, and goals from the user survey
- Prefer favored ingredients when possible, but ROTATE through them
- Do not mention allergies, time limits, or nutrition numbers (those are handled by filters)
- Avoid full sentences, explanations, or fluff
- Use lowercase
- Be concrete and food-focused
- Each prompt should be meaningfully different from ALL other prompts for that meal type

You must return your response as a valid JSON object with "breakfast", "lunch", and "dinner" fields. Each field should contain an array of strings (one string per prompt requested for that meal type).`;

const multipleEmbedPromptsUserPromptTemplate = (surveyData: any, counts: { breakfast: number; lunch: number; dinner: number }, excludeRecipe?: { name?: string; ingredients?: Array<{ item: string }> }) => {
  // Extract favored ingredients from survey data
  const surveyJson = surveyData ?? {};
  const favoredIngredients = Array.isArray((surveyJson as Record<string, unknown>)?.['12'])
    ? (surveyJson as Record<string, unknown>)['12'] as string[]
    : Array.isArray((surveyJson as Record<string, unknown>)?.favored_ingredients)
    ? (surveyJson as Record<string, unknown>).favored_ingredients as string[]
    : [];

  const favoredIngredientsText = favoredIngredients.length > 0 
    ? `\n\nFAVORED INGREDIENTS TO ROTATE THROUGH: ${favoredIngredients.join(', ')}\nIMPORTANT: Rotate through these ingredients across prompts - don't use the same ones in every prompt. Use different combinations.`
    : '';

  return `${embeddingSentencePrompt}

User Survey: ${JSON.stringify(surveyData, null, 2)}${favoredIngredientsText}

Generate unique embedding prompts for each meal type:
- Breakfast: ${counts.breakfast} unique prompt(s)
- Lunch: ${counts.lunch} unique prompt(s)
- Dinner: ${counts.dinner} unique prompt(s)

${excludeRecipe ? `IMPORTANT: You are replacing a recipe. Try to create prompts that will find recipes different from: "${excludeRecipe.name}" (which contains: ${excludeRecipe.ingredients?.map(i => i.item).slice(0, 5).join(', ') || 'various ingredients'}). Make the prompts distinct from this recipe.` : ''}

CRITICAL: Balance and distribute ingredients across prompts for the same meal type.

Diversity requirements:
- Balance primary proteins/ingredients - distribute them evenly across prompts (e.g., if 7 dinner prompts: 3 chicken, 3 beef, 1 shrimp)
- It's okay to repeat the same main ingredient, but distribute it across multiple prompts rather than using it excessively
- Rotate through different favored ingredients - distribute them across prompts
- Vary cooking methods (grilled, baked, stir-fry, roasted, steamed, etc.) - use different methods even with the same protein
- Vary cuisine styles when appropriate (Italian, Asian, Mexican, Mediterranean, etc.)
- Vary flavor profiles (spicy, savory, herby, tangy, etc.) - use different flavors even with the same protein
- Use different vegetable combinations - vary vegetables even when using the same protein
- Each prompt should feel distinct through different combinations of cooking method, cuisine, vegetables, or flavors

Examples of GOOD balanced prompts for 7 dinner prompts (balanced distribution with variety):
- "spicy grilled chicken dinner with tomatoes and garlic"
- "baked chicken with roasted vegetables and herbs"
- "italian chicken parmesan with marinara sauce"
- "grilled beef steak with roasted potatoes"
- "beef stir-fry with bell peppers and onions"
- "mexican beef tacos with fresh salsa"
- "garlic shrimp scampi with pasta"

Examples of BAD prompts (unbalanced - too much repetition):
- "spicy chicken breakfast with tomatoes and garlic"
- "savory chicken breakfast with tomatoes and herbs"
- "garlic chicken breakfast with fresh tomatoes"
- "chicken breakfast with tomatoes"
- "chicken breakfast with garlic tomatoes"

All prompts must stay within the user's preferences, goals, and constraints, but use DIFFERENT combinations of those preferences.

Return your response as a JSON object with this exact structure:
{
  "breakfast": ["first breakfast phrase", "second breakfast phrase", ...],
  "lunch": ["first lunch phrase", "second lunch phrase", ...],
  "dinner": ["first dinner phrase", "second dinner phrase", ...]
}

Note: If a meal type has count 0, return an empty array for that meal type.

FINAL CHECK: Before returning, verify that:
- Primary proteins/ingredients are balanced and distributed across prompts (not all the same, but some repetition is okay)
- Cooking methods are varied across prompts (even when using the same protein)
- Flavor profiles are varied across prompts (even when using the same protein)
- Each prompt feels distinct through different combinations of method, cuisine, vegetables, or flavors

Return ONLY the JSON object, no other text or explanation. Do not include 'JSON' or extra quotes. Begin and end your response with { and } respectively.`;
};

export { 
  MEASUREMENT_UNITS_PROMPT, 
  mealPlanFromSurveyPrompt, 
  embeddingSentencePrompt,
  embeddingPromptsSystemPrompt,
  embeddingPromptsUserPromptTemplate,
  multipleEmbedPromptsSystemPrompt,
  multipleEmbedPromptsUserPromptTemplate
};

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

const mealPlanFromSurveyPrompt = `You are an expert meal planner. Build a personalized meal plan by MODIFYING provided recipes to align with user goals, then scheduling them.

You MAY reuse the same recipe across multiple meal slots (duplicate recipes across the schedule is allowed and encouraged when it supports budget/time/ingredient reuse), but you must still follow all restrictions.

### Input:
You will be given:
1) user_survey (same schema as the example below)
2) favored_ingredients (optional)
3) excluded_ingredients (optional)
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
  "10": ["Wednesday", "Sunday"],
  "11": ["Cost efficiency", "Nutrition", "Time saving"]
}

### Your Task:
Using the provided_recipes (one per distinct meal type):
1) MODIFY each recipe to align with user goals and preferences:
   - For high protein goals: Ensure EVERY recipe includes a quality protein source. If a recipe lacks protein, ADD a quality protein source (e.g., chicken, fish, tofu, beans, eggs, Greek yogurt) that fits the dish.
   - For cost efficiency goals: CONSOLIDATE ingredients across ALL recipes. Modify recipes to use the same ingredients where possible (e.g., if multiple recipes need vegetables, use the same vegetables; if multiple recipes need proteins, use the same protein source). This reduces grocery costs by maximizing ingredient reuse.
   - Adjust quantities, swap ingredients, or add/remove components as needed to meet goals
   - Remove or replace any excluded ingredients
   - Ensure ingredients have valid quantities + units
   - Ensure steps are clear (4–10 steps)
2) Schedule the modified recipes across ALL meal_slots (you may reuse the same modified recipe across multiple slots).
3) Produce:
   - recipes[] (all unique modified recipes, one per distinct meal type from provided_recipes)
   - schedule[] (one entry per requested meal slot)
   - grocery_list[] (consolidated totals, best-effort)

### Hard Rules (must follow):
A) Do NOT invent new recipes. Every recipe MUST be based on a provided_recipes entry. You MUST modify ALL provided recipes to align with user goals.
B) Do NOT include any excluded ingredients (excluded_ingredients). If a provided recipe includes an excluded ingredient, you MUST remove or replace it.
C) Respect dietary restrictions (Question 6) and allergies (Question 7). Modify recipes to comply with all restrictions.
D) Fill EVERY meal slot in meal_slots with a schedule entry.
E) schedule.recipeId MUST reference an id in recipes[].
F) All recipes MUST include: id, name, mealType, servings, ingredients, steps.
G) Follow Measurement Units rules exactly (no "tbsp"; use "tbs" or "tb").
H) You MUST use ALL provided recipes. Each provided recipe becomes one distinct recipe in your output (modified to align with goals).

### Protein Requirements:
If "Nutrition" is ranked #1 in priorities (Question 11) OR "Eat healthier" is included in goals (Question 9):
- EVERY recipe MUST include a good quality protein source. You MUST MODIFY recipes to add or enhance protein if the provided recipe lacks adequate protein.
  Examples of quality protein sources:
  - Animal: chicken, turkey, beef, pork, fish/seafood, eggs, Greek yogurt, cottage cheese
  - Plant: tofu, tempeh, beans/lentils/chickpeas, quinoa, nuts, seeds
- Aim for 15–20g protein per serving for lunch/dinner.
- Breakfast proteins: eggs, Greek yogurt, cottage cheese, protein powder, nut butters.

CRITICAL: If a provided recipe lacks a protein source or has insufficient protein, you MUST modify it by adding a quality protein source that makes sense for the dish. Do not leave recipes without adequate protein when this requirement is triggered.

### User Priorities (Question 11) — follow ranked order:
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

### Budget Guidance (Question 3):
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

### Flavors (Question 8):
When modifying recipes, adjust flavors to match requested preferences (Savory/Spicy/Sweet/etc.) without violating exclusions. Add spices, seasonings, or flavor components as needed.

### Goals (Question 9):
- Eat healthier: MODIFY recipes to include mandatory protein + healthier choices (replace processed items with whole foods)
- Learn new recipes: MODIFY 1–2 recipes to include a slightly new technique (still within skill/time constraints)
- Save money: MODIFY recipes to maximize ingredient reuse + use low-cost ingredients; CONSOLIDATE ingredients across ALL recipes (modify recipes to use the same ingredients where possible to reduce grocery costs)
- Reduce waste: MODIFY recipes to use ingredients fully across multiple recipes (ensure shared ingredients are used completely)

### Measurement Units:
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
      "portionMultiplier": 1
    }
  ],
  "grocery_list": [
    { "item": "Ingredient Name", "quantity": "Total Amount + Unit" }
  ]
}

### Validation Checklist (must satisfy before output):
1) schedule length === meal_slots length (every slot filled)
2) Every schedule.recipeId exists in recipes[].id
3) No excluded ingredients appear in any modified recipe
4) Units comply with Measurement Units rules (no tbsp)
5) Protein requirement satisfied for every recipe when triggered (recipes must be modified to include quality protein sources)
6) Recipes are modified to align with user goals:
   - If cost efficiency/save money: ingredients are consolidated across recipes (same ingredients used in multiple recipes)
   - If nutrition/eat healthier: quality protein sources are present in all recipes
   - All other goals are addressed through modifications
7) ALL provided recipes are used and modified (one distinct modified recipe per provided recipe)
`;

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

export { 
  MEASUREMENT_UNITS_PROMPT, 
  mealPlanFromSurveyPrompt, 
  embeddingSentencePrompt,
  embeddingPromptsSystemPrompt,
  embeddingPromptsUserPromptTemplate
};

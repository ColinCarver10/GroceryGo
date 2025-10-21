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

const mealPlanFromSurveyPrompt = `You are an expert meal planner generating personalized meal plans based on user preferences.  
Use the provided user input (below) to generate a detailed meal plan.

### Input format example:
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

### Your task:
1. **Number of recipes** (CRITICAL):  
   Generate the EXACT number of recipes specified in special instructions below.
   Distribute precisely by meal type (breakfast, lunch, dinner) as specified.
   COUNT before outputting. If count is wrong, your response will be rejected.

2. **Dietary restrictions and allergies**:  
   - DO NOT include ingredients from question 6 (Dietary Restrictions) or question 7 (Allergies).
   - If none listed, no restrictions apply.

3. **User priorities (Question 11)** - Follow ranked priorities:
   - **Nutrition #1**: Use whole, fresh ingredients. Include protein in every recipe (chicken, fish, eggs, tofu, legumes, yogurt).
   - **Cost efficiency #1**: Reuse ingredients. Limit unique items (under 20 for "$50-100" budget).
   - **Time saving #1**: Use pre-made/pre-cut items (rotisserie chicken, salad kits).

4. **Budget (Question 3)**: "$50-100" = under 20 unique items; "$101-200" = under 30 items; "$200+" = flexible but reuse encouraged.

5. **Skill level (Question 4)**: Beginner = simple; Intermediate = moderate; Advanced = complex techniques OK.

6. **Time (Question 5)**: "Quick (15-30 min)" = fast recipes; "Standard (30-45 min)" = moderate; "Extended (45+ min)" = complex OK.

7. **Flavors (Question 8)**: Incorporate requested flavor profiles.

8. **Goals (Question 9)**:
   - "Eat healthier": Include protein in every recipe.
   - "Learn new recipes": Introduce 1-2 new techniques.
   - "Save money": Reuse ingredients maximally.
   - "Reduce waste": Use ingredients fully across recipes.

9. **Measurement Units**:
${MEASUREMENT_UNITS_PROMPT}

---
Only output the JSON object, no other text or explanation.
### **Output Format:**

json
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

**Important**: Every recipe MUST include a "mealType" field indicating the type of meal (Breakfast, Lunch, or Dinner).`;

export { MEASUREMENT_UNITS_PROMPT, mealPlanFromSurveyPrompt };

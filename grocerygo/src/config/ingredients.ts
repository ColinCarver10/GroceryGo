/**
 * Server-side ingredient list
 * This list is stored server-side to prevent frontend manipulation
 * All ingredients used in meal planning must come from this list
 */

export const INGREDIENTS = [
  "olive oil",
  "butter",
  "onion",
  "garlic",
  "sugar",
  "egg",
  "milk",
  "flour",
  "tomatoes",
  "vegetable oil",
  "chicken",
  "rice",
  "cheese",
  "lemon",
  "vinegar",
  "soy sauce",
  "bread",
  "potato",
  "carrots",
  "beef",
  "parsley",
  "cheddar cheese",
  "parmesan cheese",
  "mushrooms",
  "bell pepper",
  "green onion",
  "spinach",
  "bacon",
  "mayonnaise",
  "sour cream",
  "yogurt",
  "chicken broth",
  "tomato sauce",
  "tomato paste",
  "cream",
  "lemon juice",
  "lime juice",
  "mustard",
  "ketchup",
  "honey",
  "corn",
  "peas",
  "celery",
  "broccoli",
  "cucumber",
  "avocado",
  "zucchini",
  "shrimp",
  "salmon",
  "tuna",
  "pork",
  "turkey",
  "ham",
  "pasta",
  "spaghetti",
  "noodles",
  "ground beef",
  "chicken breasts",
  "chicken thighs",
  "sausages",
  "tortillas",
  "flour tortillas",
  "corn tortillas",
  "pasta sauce",
  "marinara sauce",
  "pizza sauce",
  "pizza dough",
  "breadcrumbs",
  "cornstarch",
  "oats",
  "yeast",
  "heavy cream",
  "cream cheese",
  "ricotta cheese",
  "swiss cheese",
  "monterey jack cheese",
  "mozzarella cheese",
  "feta cheese",
  "goat cheese",
  "blue cheese",
  "beans",
  "black beans",
  "chickpeas",
  "lentils",
  "kidney beans",
  "pinto beans",
  "white beans",
  "nuts",
  "almonds",
  "walnuts",
  "pecans",
  "peanut butter",
  "sesame seeds",
  "cornmeal",
  "rice vinegar",
  "red wine vinegar",
  "white vinegar",
  "olive oil cooking spray",
  "cooking spray",
  "buttermilk",
  "evaporated milk",
  "sweetened condensed milk",
  "cool whip",
  "whipped cream",
  "ice cream",
  "maple syrup",
  "molasses",
  "brown sugar",
  "powdered sugar",
  "raisins",
  "cranberries",
  "blueberries",
  "strawberries",
  "raspberries",
  "banana",
  "apple",
  "orange",
  "lime",
  "pineapple",
  "coconut",
  "coconut milk",
  "almond milk",
  "oat milk",
  "soy milk",
  "egg whites",
  "egg yolks",
  "lettuce",
  "romaine lettuce",
  "iceberg lettuce",
  "mixed greens",
  "cabbage",
  "cauliflower",
  "green beans",
  "sweet potatoes",
  "eggplant",
  "asparagus",
  "brussels sprouts",
  "leeks",
  "shallot",
  "ginger",
  "jalapeno",
  "green chilies",
  "hot sauce",
  "barbecue sauce",
  "salsa",
  "worcestershire sauce",
  "balsamic vinegar",
  "red wine",
  "white wine",
  "beer",
  "fish",
  "sardines",
  "anchovies",
  "tofu",
  "quinoa",
  "couscous",
  "barley",
  "granola",
  "cereal",
  "gelatin",
  "cake mix",
  "brownie mix",
  "pudding mix",
  "pumpkin puree",
  "pumpkin seeds",
  "sunflower seeds",
  "chia seeds",
  "flax seeds",
  "artichoke hearts",
  "capers",
  "olives",
  "pickles",
  "duck",
  "lamb"
] as const

/**
 * Get the list of available ingredients
 * This function can be used by server actions
 */
export function getIngredients(): readonly string[] {
  return INGREDIENTS
}

/**
 * Validate if an ingredient is in the predefined list (case-insensitive)
 */
export function isValidIngredient(ingredient: string): boolean {
  const lowerIngredient = ingredient.toLowerCase()
  return INGREDIENTS.some(ing => ing.toLowerCase() === lowerIngredient)
}

/**
 * Validate and filter an array of ingredients to only include valid ones
 * Returns the original ingredient names (preserving case from predefined list)
 */
export function validateIngredients(ingredients: string[]): string[] {
  const validIngredients: string[] = []
  
  for (const ingredient of ingredients) {
    const lowerIngredient = ingredient.toLowerCase()
    const found = INGREDIENTS.find(ing => ing.toLowerCase() === lowerIngredient)
    if (found && !validIngredients.includes(found)) {
      validIngredients.push(found)
    }
  }
  
  return validIngredients
}


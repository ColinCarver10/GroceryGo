import test from 'node:test'
import assert from 'node:assert/strict'
import { ImportedRecipeSchema } from './mealPlanSchemas'

test('ImportedRecipeSchema accepts valid extracted recipe payload', () => {
  const parsed = ImportedRecipeSchema.safeParse({
    name: 'Sheet Pan Chicken',
    description: 'Simple weeknight dinner.',
    ingredients: [
      { item: 'chicken thighs', quantity: '2 lb' },
      { item: 'olive oil', quantity: '2 tbsp', unit: 'tbsp' }
    ],
    steps: ['Preheat oven to 425F.', 'Roast for 30 minutes.'],
    prep_time_minutes: 10,
    cook_time_minutes: 30,
    servings: 4,
    difficulty: 'beginner',
    mealType: 'Dinner',
    confidence: 0.82,
    missingFields: []
  })

  assert.equal(parsed.success, true)
})

test('ImportedRecipeSchema rejects payload without ingredients or steps', () => {
  const parsed = ImportedRecipeSchema.safeParse({
    name: 'Broken Recipe',
    ingredients: [],
    steps: [],
    confidence: 0.5,
    missingFields: ['ingredients', 'steps']
  })

  assert.equal(parsed.success, false)
})

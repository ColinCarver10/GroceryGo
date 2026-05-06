import test from 'node:test'
import assert from 'node:assert/strict'
import type { Recipe } from '@/types/database'
import { buildGlobalRecipesResult } from './globalRecipes'

function makeRecipe(overrides: Partial<Recipe>): Recipe {
  return {
    id: overrides.id || `recipe-${Math.random().toString(36).slice(2)}`,
    created_at: overrides.created_at || new Date().toISOString(),
    name: overrides.name || 'Recipe',
    ingredients: overrides.ingredients || [{ item: 'salt', quantity: '1 tsp' }],
    steps: overrides.steps || ['Mix'],
    ...overrides
  }
}

test('deduplicates by recipe id and ranks by save count', () => {
  const alpha = makeRecipe({ id: 'alpha', name: 'Alpha Bowl' })
  const beta = makeRecipe({ id: 'beta', name: 'Beta Pasta' })

  const result = buildGlobalRecipesResult([
    { recipe_id: 'alpha', created_at: '2026-05-01T00:00:00.000Z', recipe: alpha },
    { recipe_id: 'alpha', created_at: '2026-05-02T00:00:00.000Z', recipe: alpha },
    { recipe_id: 'beta', created_at: '2026-05-03T00:00:00.000Z', recipe: beta }
  ])

  assert.equal(result.total, 2)
  assert.equal(result.recipes[0]?.recipe.id, 'alpha')
  assert.equal(result.recipes[0]?.saveCount, 2)
  assert.equal(result.recipes[1]?.recipe.id, 'beta')
})

test('search matches recipe name, ingredients, and tags', () => {
  const tagRecipe = makeRecipe({
    id: 'tagged',
    name: 'Simple Plate',
    ingredients: [{ item: 'chickpeas', quantity: '1 cup' }],
    dietary_tags: ['high-protein']
  })
  const plainRecipe = makeRecipe({
    id: 'plain',
    name: 'Other Dish',
    ingredients: [{ item: 'rice', quantity: '1 cup' }]
  })

  const ingredientMatch = buildGlobalRecipesResult([
    { recipe_id: 'tagged', created_at: '2026-05-01T00:00:00.000Z', recipe: tagRecipe },
    { recipe_id: 'plain', created_at: '2026-05-01T00:00:00.000Z', recipe: plainRecipe }
  ], { search: 'chickpeas' })
  assert.equal(ingredientMatch.total, 1)
  assert.equal(ingredientMatch.recipes[0]?.recipe.id, 'tagged')

  const tagMatch = buildGlobalRecipesResult([
    { recipe_id: 'tagged', created_at: '2026-05-01T00:00:00.000Z', recipe: tagRecipe },
    { recipe_id: 'plain', created_at: '2026-05-01T00:00:00.000Z', recipe: plainRecipe }
  ], { search: 'high-protein' })
  assert.equal(tagMatch.total, 1)
  assert.equal(tagMatch.recipes[0]?.recipe.id, 'tagged')
})

test('meal type filter and pagination works', () => {
  const breakfast = makeRecipe({ id: 'b1', name: 'Egg Toast', meal_type: ['breakfast'] })
  const dinner = makeRecipe({ id: 'd1', name: 'Steak Bowl', meal_type: ['dinner'] })
  const lunch = makeRecipe({ id: 'l1', name: 'Chicken Wrap', meal_type: ['lunch'] })

  const filtered = buildGlobalRecipesResult([
    { recipe_id: 'b1', created_at: '2026-05-01T00:00:00.000Z', recipe: breakfast },
    { recipe_id: 'd1', created_at: '2026-05-01T00:00:00.000Z', recipe: dinner },
    { recipe_id: 'l1', created_at: '2026-05-01T00:00:00.000Z', recipe: lunch }
  ], { mealType: 'dinner' })
  assert.equal(filtered.total, 1)
  assert.equal(filtered.recipes[0]?.recipe.id, 'd1')

  const paged = buildGlobalRecipesResult([
    { recipe_id: 'b1', created_at: '2026-05-01T00:00:00.000Z', recipe: breakfast },
    { recipe_id: 'd1', created_at: '2026-05-02T00:00:00.000Z', recipe: dinner },
    { recipe_id: 'l1', created_at: '2026-05-03T00:00:00.000Z', recipe: lunch }
  ], { limit: 2, offset: 1 })
  assert.equal(paged.recipes.length, 2)
  assert.equal(paged.total, 3)
  assert.equal(paged.hasMore, false)
})

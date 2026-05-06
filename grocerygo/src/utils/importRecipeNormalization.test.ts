import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeImportedRecipePayload } from './importRecipeNormalization'

test('normalizes string ingredients with leading quantity and unit', () => {
  const normalized = normalizeImportedRecipePayload({
    title: 'Test Recipe',
    ingredients: ['75g soy sauce', '2 stalks green onions, chopped'],
    instructions: ['Mix and cook'],
    confidence: 0.9
  })

  assert.deepEqual(normalized.ingredients[0], {
    item: 'soy sauce',
    quantity: '75 g',
    unit: 'g'
  })
  assert.deepEqual(normalized.ingredients[1], {
    item: 'green onions, chopped',
    quantity: '2 stalks',
    unit: 'stalks'
  })
})

test('preserves explicit descriptive quantities from source text', () => {
  const normalized = normalizeImportedRecipePayload({
    title: 'Seasoning Test',
    ingredients: ['Salt, to taste', 'Milk, as needed for desired consistency'],
    steps: ['Season food'],
    confidence: 0.7
  })

  assert.equal(normalized.ingredients[0]?.quantity, 'to taste')
  assert.equal(normalized.ingredients[1]?.quantity, 'as needed for desired consistency')
})

test('does not inject synthetic to taste fallback when quantity missing', () => {
  const normalized = normalizeImportedRecipePayload({
    name: 'No Fallback',
    ingredients: [{ name: 'soy sauce' }, 'green onions'],
    steps: ['Combine ingredients'],
    confidence: 0.6
  })

  assert.equal(normalized.ingredients.length, 0)
})

test('maps object ingredient numeric quantity to string quantity', () => {
  const normalized = normalizeImportedRecipePayload({
    title: 'Object Quantity',
    ingredients: [{ name: 'honey', quantity: 80, unit: 'g' }],
    steps: ['Mix'],
    confidence: 0.8
  })

  assert.deepEqual(normalized.ingredients[0], {
    item: 'honey',
    quantity: '80 g',
    unit: 'g'
  })
})

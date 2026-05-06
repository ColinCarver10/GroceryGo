import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeSelectedSavedWithAICandidates } from './candidateMerge.ts'
import {
  buildProvidedRecipesPromptSection,
  computeRemainingCounts,
  normalizeSelectedSavedRecipeIds
} from './promptContext.ts'

test('uses selected saved recipes when they fill all distinct counts', () => {
  const result = mergeSelectedSavedWithAICandidates({
    distinctCounts: { breakfast: 2, lunch: 1, dinner: 1 },
    selectedSavedRecipeIds: {
      breakfast: ['b1', 'b2'],
      lunch: ['l1'],
      dinner: ['d1']
    },
    aiCandidateIds: {
      breakfast: ['ab1', 'ab2'],
      lunch: ['al1'],
      dinner: ['ad1']
    }
  })

  assert.deepEqual(result, {
    breakfast: ['b1', 'b2'],
    lunch: ['l1'],
    dinner: ['d1']
  })
})

test('fills remaining distinct slots with AI candidates', () => {
  const result = mergeSelectedSavedWithAICandidates({
    distinctCounts: { breakfast: 3, lunch: 2, dinner: 2 },
    selectedSavedRecipeIds: {
      breakfast: ['b1'],
      lunch: ['l1'],
      dinner: []
    },
    aiCandidateIds: {
      breakfast: ['ab1', 'ab2', 'ab3'],
      lunch: ['al1', 'al2'],
      dinner: ['ad1', 'ad2']
    }
  })

  assert.deepEqual(result, {
    breakfast: ['b1', 'ab1', 'ab2'],
    lunch: ['l1', 'al1'],
    dinner: ['ad1', 'ad2']
  })
})

test('dedupes and skips repeated IDs across saved and AI lists', () => {
  const result = mergeSelectedSavedWithAICandidates({
    distinctCounts: { breakfast: 2, lunch: 2, dinner: 1 },
    selectedSavedRecipeIds: {
      breakfast: ['b1', 'b1'],
      lunch: ['l1'],
      dinner: []
    },
    aiCandidateIds: {
      breakfast: ['b1', 'ab1'],
      lunch: ['l1', 'al1', 'al2'],
      dinner: ['ad1']
    }
  })

  assert.deepEqual(result, {
    breakfast: ['b1', 'ab1'],
    lunch: ['l1', 'al1'],
    dinner: ['ad1']
  })
})

test('computes remaining counts from distinct minus valid saved selections', () => {
  const remaining = computeRemainingCounts(
    { breakfast: 3, lunch: 2, dinner: 1 },
    {
      breakfast: ['b1', 'b2'],
      lunch: ['l1'],
      dinner: ['d1', 'd2']
    }
  )

  assert.deepEqual(remaining, {
    breakfast: 1,
    lunch: 1,
    dinner: 0
  })
})

test('provided recipes prompt section includes source tags and saved-preservation rules', () => {
  const section = buildProvidedRecipesPromptSection({
    distinctCounts: { breakfast: 1, lunch: 1, dinner: 0 },
    breakfastRecipes: [{ recipe_id: 'b1', name: 'Egg Scramble' }],
    lunchRecipes: [{ recipe_id: 'l1', name: 'Chicken Bowl' }],
    dinnerRecipes: [],
    validSelectedSavedIds: {
      breakfast: ['b1'],
      lunch: [],
      dinner: []
    }
  })

  assert.ok(section.includes('"source": "saved"'))
  assert.ok(section.includes('"source": "ai_candidate"'))
  assert.ok(section.includes('do NOT replace it with a different recipe'))
})

test('normalizes selected saved IDs by trimming and deduping without dropping UUIDs', () => {
  const normalized = normalizeSelectedSavedRecipeIds({
    breakfast: ['1', '1', '  bd553286-5161-45d1-86e4-915dbf6c95a0  '],
    lunch: ['2', '003', ''],
    dinner: ['not-a-number', '4']
  })

  assert.deepEqual(normalized, {
    breakfast: ['1', 'bd553286-5161-45d1-86e4-915dbf6c95a0'],
    lunch: ['2', '003'],
    dinner: ['not-a-number', '4']
  })
})

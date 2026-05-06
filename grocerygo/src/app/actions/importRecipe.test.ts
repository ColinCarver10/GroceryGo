import test from 'node:test'
import { importRecipeFromUrl } from './importRecipe'

test.skip('importRecipeFromUrl integration requires dependency injection', async () => {
  await importRecipeFromUrl({ url: 'https://example.com/chili' })
})

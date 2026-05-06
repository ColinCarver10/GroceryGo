import test from 'node:test'
import assert from 'node:assert/strict'
import { classifySource, extractRecipeSource, validateImportUrl } from './recipeImportExtractor'

test('validateImportUrl allows normal https urls', () => {
  const result = validateImportUrl('https://example.com/recipe')
  assert.equal(result.ok, true)
})

test('validateImportUrl blocks localhost and private ip targets', () => {
  const localhost = validateImportUrl('http://localhost:3000')
  assert.equal(localhost.ok, false)

  const privateIp = validateImportUrl('http://192.168.1.10/path')
  assert.equal(privateIp.ok, false)
})

test('classifySource maps supported social hosts', () => {
  assert.equal(classifySource('https://instagram.com/p/abc123/'), 'instagram')
  assert.equal(classifySource('https://www.tiktok.com/@user/video/123'), 'tiktok')
  assert.equal(classifySource('https://www.youtube.com/watch?v=xyz'), 'youtube')
  assert.equal(classifySource('https://example.com/recipe/chili'), 'website')
})

test('extractRecipeSource pulls json-ld recipe hints', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () =>
    new Response(
      `<!doctype html>
      <html>
        <head>
          <title>Spicy Pasta</title>
          <script type="application/ld+json">
            {
              "@context":"https://schema.org",
              "@type":"Recipe",
              "name":"Spicy Pasta",
              "recipeIngredient":["1 lb pasta","2 cloves garlic"]
            }
          </script>
        </head>
        <body>Great pasta recipe.</body>
      </html>`,
      { headers: { 'content-type': 'text/html' }, status: 200 }
    )

  try {
    const extracted = await extractRecipeSource('https://example.com/spicy-pasta')
    assert.equal(extracted.title, 'Spicy Pasta')
    assert.equal(extracted.sourceType, 'website')
    assert.equal((extracted.structuredHints as { name?: string })?.name, 'Spicy Pasta')
    assert.match(extracted.rawText, /Great pasta recipe/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

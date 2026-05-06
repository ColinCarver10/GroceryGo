import type { ExtractedRecipeSource } from '@/utils/recipeImportExtractor'
import { MEASUREMENT_UNITS_PROMPT } from '@/app/meal-plan-generate/prompts'

export function getImportRecipeSystemPrompt(): string {
  return `You extract recipes from scraped webpage/social text.

Rules:
- Return only fields supported by the schema.
- Use only evidence from provided text and structured hints.
- If a field is uncertain, omit it or add it to missingFields.
- Never invent ingredients or steps that are not present.
- Keep steps concise and action-oriented.
- confidence must reflect extraction quality (0 to 1).
- For ingredients, output objects with "item" and "quantity" where quantity is "Amount + Unit".
- Do not fabricate generic quantity defaults.
- If truly unknown, leave quantity missing rather than inventing.
- NEVER use "tbsp"; use "tb" or "tbs".
- Output ingredient quantities for EXACTLY ONE portion.
- If source recipe yields multiple portions, divide ingredient quantities proportionally so output reflects 1 portion.
- Set servings to 1 in the output.`
}

export function getImportRecipeUserPrompt(extracted: ExtractedRecipeSource): string {
  const hints = extracted.structuredHints
  const hintsBlock = hints
    ? JSON.stringify(hints, null, 2)
    : '{}'

  return `Extract a single recipe from this source.

Source URL: ${extracted.sourceUrl}
Source Type: ${extracted.sourceType}
Title: ${extracted.title || 'Unknown'}
Author: ${extracted.author || 'Unknown'}

Structured Hints (if available):
${hintsBlock}

Raw Extracted Text:
${extracted.rawText}

Measurement Units Rules:
${MEASUREMENT_UNITS_PROMPT}

Portion Rule:
- Return ingredients scaled to 1 portion.
- If source says it makes N portions, divide ingredient quantities by N.
- Set servings to 1.`
}

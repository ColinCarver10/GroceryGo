type NormalizedIngredient = {
  item: string
  quantity: string
  unit?: string
}

type NormalizedRecipe = Record<string, unknown> & {
  ingredients: NormalizedIngredient[]
}

const UNIT_PATTERN = '(?:cup|cups|c|fl oz|gallon|gallons|gal|gals|milliliter|milliliters|ml|mls|liter|liters|l|pint|pints|pt|pts|quart|quarts|qt|qts|tablespoon|tablespoons|tb|tbs|teaspoon|teaspoons|ts|tsp|tspn|gram|grams|g|gs|kilogram|kilograms|kg|kgs|ounce|ounces|oz|pound|pounds|lb|lbs|bunch|bunches|can|cans|each|ears|head|heads|large|lrg|lge|lg|medium|med|md|package|packages|packet|small|sm|container|jar|pouch|bag|box|stalk|stalks)'
const LEADING_QUANTITY_REGEX = new RegExp(
  `^(\\d+(?:\\.\\d+)?(?:\\s+\\d\\/\\d|\\/\\d)?)\\s*(${UNIT_PATTERN})\\b\\s*(.+)$`,
  'i'
)

export function normalizeImportedRecipePayload(input: unknown): NormalizedRecipe {
  if (!input || typeof input !== 'object') {
    return { ingredients: [] }
  }

  const data = input as Record<string, unknown>
  const rawIngredients = Array.isArray(data.ingredients) ? data.ingredients : []
  const ingredients = rawIngredients
    .map((ingredient) => normalizeIngredient(ingredient))
    .filter((ingredient): ingredient is NormalizedIngredient => ingredient !== null)

  const rawSteps = data.steps ?? data.instructions
  const steps = Array.isArray(rawSteps)
    ? rawSteps.map((step) => String(step).trim()).filter(Boolean)
    : typeof rawSteps === 'string'
      ? rawSteps.split('\n').map((step) => step.trim()).filter(Boolean)
      : []

  const confidenceValue = typeof data.confidence === 'number'
    ? data.confidence
    : typeof data.confidence === 'string'
      ? Number.parseFloat(data.confidence)
      : 0.5

  const mealTypeValue = normalizeMealType(data.mealType ?? data.meal_type)

  return {
    name: stringOrUndefined(data.name ?? data.title),
    description: stringOrUndefined(data.description),
    ingredients,
    steps,
    prep_time_minutes: numberOrUndefined(data.prep_time_minutes ?? data.prepTimeMinutes),
    cook_time_minutes: numberOrUndefined(data.cook_time_minutes ?? data.cookTimeMinutes),
    servings: numberOrUndefined(data.servings) ?? parseServings(data.yields),
    difficulty: stringOrUndefined(data.difficulty),
    mealType: mealTypeValue,
    confidence: Number.isFinite(confidenceValue) ? confidenceValue : 0.5,
    missingFields: Array.isArray(data.missingFields)
      ? data.missingFields.map((field) => String(field))
      : []
  }
}

function normalizeIngredient(ingredient: unknown): NormalizedIngredient | null {
  if (!ingredient) return null

  if (typeof ingredient === 'string') {
    return normalizeStringIngredient(ingredient)
  }

  if (typeof ingredient !== 'object') return null
  const candidate = ingredient as Record<string, unknown>
  const item = stringOrUndefined(candidate.item ?? candidate.name ?? candidate.ingredient)
  const explicitQuantity = quantityToString(candidate.quantity ?? candidate.amount)
  const unit = stringOrUndefined(candidate.unit)
  const noteQuantity = stringOrUndefined(candidate.notes)

  if (!item) return null

  const quantityFromExplicit = explicitQuantity
    ? unit
      ? `${explicitQuantity} ${unit}`
      : explicitQuantity
    : undefined
  const quantity = quantityFromExplicit ?? extractDescriptiveQuantity(noteQuantity)

  if (!quantity) return null
  return { item, quantity, unit }
}

function normalizeStringIngredient(raw: string): NormalizedIngredient | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const descriptiveQuantity = extractDescriptiveQuantity(trimmed)
  if (descriptiveQuantity) {
    const itemPart = trimmed.replace(/,\s*(to taste|as needed.*)$/i, '').trim()
    if (!itemPart) return null
    return { item: itemPart, quantity: descriptiveQuantity }
  }

  const parsedLeading = parseLeadingQuantity(trimmed)
  if (!parsedLeading) return null
  return {
    item: parsedLeading.item,
    quantity: parsedLeading.quantity,
    unit: parsedLeading.unit
  }
}

function parseLeadingQuantity(value: string): { item: string; quantity: string; unit?: string } | null {
  const normalizedValue = value.replace(/[–—]/g, '-').trim()
  const match = normalizedValue.match(LEADING_QUANTITY_REGEX)
  if (!match) return null

  const amount = match[1].trim()
  const unit = match[2].trim()
  const item = match[3].trim().replace(/^[-,:]\s*/, '')
  if (!item) return null

  return {
    item,
    quantity: `${amount} ${unit}`.trim(),
    unit
  }
}

function extractDescriptiveQuantity(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined

  if (/to taste/i.test(trimmed)) return 'to taste'
  const asNeeded = trimmed.match(/as needed[^,.;)]*/i)
  if (asNeeded) return asNeeded[0].trim()
  return undefined
}

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function quantityToString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return undefined
}

function parseServings(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined
  const match = value.match(/(\d+)/)
  if (!match) return undefined
  const servings = Number.parseInt(match[1], 10)
  return Number.isFinite(servings) ? servings : undefined
}

function normalizeMealType(value: unknown): 'Breakfast' | 'Lunch' | 'Dinner' | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'breakfast') return 'Breakfast'
  if (normalized === 'lunch') return 'Lunch'
  if (normalized === 'dinner') return 'Dinner'
  return undefined
}

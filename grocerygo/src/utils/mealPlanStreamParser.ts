/**
 * Utility functions for parsing meal plan generation API streaming responses
 */

export interface ParsedMealPlanResponse {
  recipes: Array<{
    id?: string
    name: string
    mealType?: string
    ingredients: Array<{ item: string; quantity: string }>
    steps: string[]
    servings?: number
    [key: string]: unknown
  }>
  grocery_list: Array<{ item: string; quantity: string }>
  schedule?: Array<{ recipeId: string; [key: string]: unknown }>
}

/**
 * Parse a complete streaming response buffer into a structured meal plan response
 * @param buffer - The complete response buffer from the streaming API
 * @returns Parsed meal plan response or null if parsing fails
 */
export function parseMealPlanStreamResponse(
  buffer: string
): ParsedMealPlanResponse | null {
  try {
    if (!buffer || buffer.trim().length === 0) {
      return null
    }

    const jsonMatch = buffer.match(/```json\n?([\s\S]*?)\n?```/) || buffer.match(/```\n?([\s\S]*?)\n?```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : buffer
    const aiResponse = JSON.parse(jsonStr.trim()) as {
      recipes?: Array<{
        id?: string
        name: string
        mealType?: string
        ingredients: Array<{ item: string; quantity: string }>
        steps: string[]
        servings?: number
        [key: string]: unknown
      }>
      grocery_list?: Array<{ item: string; quantity: string }>
      schedule?: Array<{ recipeId: string; [key: string]: unknown }>
    }

    return {
      recipes: Array.isArray(aiResponse.recipes) ? aiResponse.recipes : [],
      grocery_list: Array.isArray(aiResponse.grocery_list) ? aiResponse.grocery_list : [],
      schedule: Array.isArray(aiResponse.schedule) ? aiResponse.schedule : undefined
    }
  } catch (error) {
    console.error('Error parsing meal plan stream response:', error)
    return null
  }
}

/**
 * Read and parse a streaming response from a fetch ReadableStream
 * @param response - The fetch Response object with a streamable body
 * @returns Parsed meal plan response or null if parsing fails
 */
export async function readAndParseMealPlanStream(
  response: Response
): Promise<ParsedMealPlanResponse | null> {
  const reader = response.body?.getReader()
  if (!reader) {
    return null
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    buffer += chunk
  }

  return parseMealPlanStreamResponse(buffer)
}


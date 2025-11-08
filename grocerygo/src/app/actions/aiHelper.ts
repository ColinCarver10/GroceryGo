'use server'

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface AICallResult<T> {
  success: boolean
  data?: T
  error?: string
  rawResponse?: string
}

/**
 * Reusable OpenAI calling function
 * Accepts prompt, parsing function, and optional validation
 * Used across all features to avoid code duplication
 */
export async function callOpenAI<T>(
  systemPrompt: string,
  userPrompt: string,
  parseResponse: (response: string) => T,
  validateResponse?: (data: T) => boolean
): Promise<AICallResult<T>> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        error: 'OpenAI API key is not configured'
      }
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || ''

    if (!response) {
      return {
        success: false,
        error: 'No response generated from AI'
      }
    }

    // Try to parse the response
    let parsedData: T
    try {
      parsedData = parseResponse(response)
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      return {
        success: false,
        error: 'Failed to parse AI response',
        rawResponse: response
      }
    }

    // Validate if validator provided
    if (validateResponse && !validateResponse(parsedData)) {
      return {
        success: false,
        error: 'AI response failed validation',
        rawResponse: response
      }
    }

    return {
      success: true,
      data: parsedData,
      rawResponse: response
    }

  } catch (error: unknown) {
    console.error('OpenAI API error:', error)

    const status = getErrorStatus(error)
    if (status === 401) {
      return { success: false, error: 'Invalid OpenAI API key' }
    }

    if (status === 429) {
      return { success: false, error: 'Rate limit exceeded. Please try again later.' }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to call OpenAI API'
    }
  }
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const statusValue = (error as { status?: unknown }).status
    if (typeof statusValue === 'number') {
      return statusValue
    }
  }
  return undefined
}



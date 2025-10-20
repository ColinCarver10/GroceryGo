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
      model: 'gpt-4o-mini',
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
      max_tokens: 4000,
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

  } catch (error: any) {
    console.error('OpenAI API error:', error)

    if (error?.status === 401) {
      return { success: false, error: 'Invalid OpenAI API key' }
    }

    if (error?.status === 429) {
      return { success: false, error: 'Rate limit exceeded. Please try again later.' }
    }

    return {
      success: false,
      error: error?.message || 'Failed to call OpenAI API'
    }
  }
}

/**
 * Helper to extract JSON from markdown code blocks
 */
function extractJSON(response: string): string {
  const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) || response.match(/```\n?([\s\S]*?)\n?```/)
  return jsonMatch ? jsonMatch[1] : response
}


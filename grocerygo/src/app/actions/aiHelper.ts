'use server'

import OpenAI from 'openai'
import type { z } from 'zod'

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
 * NEW: Structured outputs function using Zod schemas
 * For non-streaming calls (replace recipe, simplify, etc.)
 * This guarantees schema compliance and proper validation
 */
export async function callOpenAIStructured<T extends z.ZodType>(
  systemPrompt: string,
  userPrompt: string,
  schema: T,
  schemaName: string = 'response'
): Promise<AICallResult<z.infer<T>>> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        error: 'OpenAI API key is not configured'
      }
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
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
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: schemaName,
          schema: schema as any,
          strict: true
        }
      },
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content

    if (!response) {
      return {
        success: false,
        error: 'No response generated from AI'
      }
    }

    // Parse the JSON response
    let parsedData: any
    try {
      parsedData = JSON.parse(response)
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      return {
        success: false,
        error: 'Failed to parse AI response'
      }
    }

    // Validate against schema
    const validationResult = schema.safeParse(parsedData)
    
    if (!validationResult.success) {
      console.error('Schema validation failed:', validationResult.error)
      return {
        success: false,
        error: `Response validation failed: ${validationResult.error.message}`
      }
    }

    // Response is guaranteed to match schema
    return {
      success: true,
      data: validationResult.data as z.infer<T>
    }

  } catch (error: any) {
    console.error('OpenAI API error:', error)

    if (error?.status === 401) {
      return { success: false, error: 'Invalid OpenAI API key' }
    }

    if (error?.status === 429) {
      return { success: false, error: 'Rate limit exceeded. Please try again later.' }
    }

    if (error?.status === 400 && error?.message?.includes('schema')) {
      return { success: false, error: 'Invalid schema format. Please contact support.' }
    }

    return {
      success: false,
      error: error?.message || 'Failed to call OpenAI API'
    }
  }
}

/**
 * Reusable OpenAI calling function (legacy version)
 * Accepts prompt, parsing function, and optional validation
 * Used across all features to avoid code duplication
 * Note: Consider migrating to callOpenAIStructured for better reliability
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
      model: 'gpt-4o',
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



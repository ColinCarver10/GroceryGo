'use server'

import OpenAI from 'openai'
import { mealPlanFromSurveyPrompt } from './prompts'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function processWithAI(userInput: string) {
  try {
    if (!userInput || userInput.trim().length === 0) {
      return { error: 'Please provide input text' }
    }

    if (!process.env.OPENAI_API_KEY) {
      return { 
        error: 'OpenAI API key is not configured. Please add OPENAI_API_KEY to your .env.local file' 
      }
    }

    // Combine the meal plan prompt with user input
    const fullPrompt = `${mealPlanFromSurveyPrompt}

### User Input:
${userInput}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using gpt-4o-mini for cost efficiency
      messages: [
        {
          role: 'system',
          content: 'You are an expert meal planning assistant for GroceryGo. Generate detailed, personalized meal plans with recipes and grocery lists in JSON format. Follow the measurement units and formatting guidelines strictly.',
        },
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000, // Increased for comprehensive meal plans with multiple recipes
    })

    const response = completion.choices[0]?.message?.content || 'No response generated'

    return { response }
  } catch (error: any) {
    console.error('OpenAI API Error:', error)
    
    if (error?.status === 401) {
      return { error: 'Invalid OpenAI API key' }
    }
    
    if (error?.status === 429) {
      return { error: 'Rate limit exceeded. Please try again later.' }
    }

    return { 
      error: error?.message || 'Failed to process request with AI' 
    }
  }
}


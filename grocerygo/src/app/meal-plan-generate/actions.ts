'use server'

import { createClient } from '@/utils/supabase/server'
import { createMealPlanFromAI } from '@/app/actions/mealPlans'
import OpenAI from 'openai'
import { mealPlanFromSurveyPrompt } from './prompts'
import type { AIGeneratedMealPlan } from '@/types/database'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface MealSelection {
  breakfast: number
  lunch: number
  dinner: number
}

export async function generateMealPlanFromPreferences(
  weekOf: string,
  mealSelection: MealSelection
) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        error: 'OpenAI API key is not configured. Please add OPENAI_API_KEY to your .env.local file'
      }
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: 'User not authenticated' }
    }

    // Get user's survey responses
    const { data: userData } = await supabase
      .from('users')
      .select('survey_response')
      .eq('user_id', user.id)
      .single()

    if (!userData?.survey_response) {
      return {
        error: 'Please complete the onboarding survey first',
        needsSurvey: true
      }
    }

    // Calculate total meals
    const totalMeals = mealSelection.breakfast + mealSelection.lunch + mealSelection.dinner

    // Build the prompt with survey data and meal selection
    const surveyData = userData.survey_response
    const mealBreakdown = []
    if (mealSelection.breakfast > 0) mealBreakdown.push(`${mealSelection.breakfast} breakfast meals`)
    if (mealSelection.lunch > 0) mealBreakdown.push(`${mealSelection.lunch} lunch meals`)
    if (mealSelection.dinner > 0) mealBreakdown.push(`${mealSelection.dinner} dinner meals`)

    const enhancedPrompt = `${mealPlanFromSurveyPrompt}

### User Input:
${JSON.stringify(surveyData, null, 2)}

### Special Instructions:
Generate exactly ${totalMeals} recipes distributed as follows:
${mealBreakdown.join(', ')}

Make sure to label each recipe with appropriate meal_type: "breakfast", "lunch", or "dinner" based on the meal distribution requested.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert meal planning assistant for GroceryGo. Generate detailed, personalized meal plans with recipes and grocery lists in JSON format. Follow the measurement units and formatting guidelines strictly.',
        },
        {
          role: 'user',
          content: enhancedPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    })

    const response = completion.choices[0]?.message?.content || 'No response generated'

    // Parse the AI response
    let aiMealPlan: AIGeneratedMealPlan
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) || response.match(/```\n?([\s\S]*?)\n?```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : response
      aiMealPlan = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError)
      return {
        response,
        parsed: false,
        error: 'Generated meal plan but failed to parse. Please try again.'
      }
    }

    // Save to database
    const result = await createMealPlanFromAI(
      user.id,
      weekOf,
      aiMealPlan,
      userData.survey_response
    )

    if (!result.success) {
      return {
        response,
        parsed: true,
        error: 'Generated meal plan but failed to save to database.'
      }
    }

    return {
      response,
      parsed: true,
      saved: true,
      mealPlanId: result.mealPlanId,
      totalMeals
    }

  } catch (error: any) {
    console.error('Meal plan generation error:', error)

    if (error?.status === 401) {
      return { error: 'Invalid OpenAI API key' }
    }

    if (error?.status === 429) {
      return { error: 'Rate limit exceeded. Please try again later.' }
    }

    return {
      error: error?.message || 'Failed to generate meal plan'
    }
  }
}


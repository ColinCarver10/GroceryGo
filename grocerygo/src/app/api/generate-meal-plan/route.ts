import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { streamObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { mealPlanFromSurveyPrompt } from '@/app/meal-plan-generate/prompts'
import { createMealPlanSchema } from '@/app/schemas/mealPlanSchemas'

interface MealSelection {
  breakfast: number
  lunch: number
  dinner: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { weekOf, mealSelection, mealPlanId } = body as {
      weekOf: string
      mealSelection: MealSelection
      mealPlanId: string
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Verify meal plan belongs to user
    const { data: mealPlan, error: mealPlanError } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('id', mealPlanId)
      .eq('user_id', user.id)
      .single()

    if (mealPlanError || !mealPlan) {
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 })
    }

    // Get user's survey responses
    const { data: userData } = await supabase
      .from('users')
      .select('survey_response')
      .eq('user_id', user.id)
      .single()

    if (!userData?.survey_response) {
      return NextResponse.json(
        { error: 'Please complete the onboarding survey first' },
        { status: 400 }
      )
    }

    // Calculate total meals
    const totalMeals = mealSelection.breakfast + mealSelection.lunch + mealSelection.dinner

    // Build the prompt
    const surveyData = userData.survey_response
    
    // Extract favored and excluded ingredients from survey response
    const favoredIngredients = surveyData.favored_ingredients || []
    const excludedIngredients = surveyData.excluded_ingredients || []
    
    // Build ingredient preferences section
    let ingredientPreferencesSection = ''
    if (favoredIngredients.length > 0 || excludedIngredients.length > 0) {
      ingredientPreferencesSection = '\n\n### Ingredient Preferences:\n'
      
      if (favoredIngredients.length > 0) {
        ingredientPreferencesSection += `**Favored Ingredients (prioritize using these):** ${favoredIngredients.join(', ')}\n`
      }
      
      if (excludedIngredients.length > 0) {
        ingredientPreferencesSection += `**Excluded Ingredients (NEVER use these):** ${excludedIngredients.join(', ')}\n`
      }
    }
    
    const enhancedPrompt = `${mealPlanFromSurveyPrompt}

### User Input:
${JSON.stringify(surveyData, null, 2)}
${ingredientPreferencesSection}`

    // Create dynamic schema with exact recipe count validation
    const mealPlanSchema = createMealPlanSchema(
      mealSelection.breakfast,
      mealSelection.lunch,
      mealSelection.dinner
    )

    // Use AI SDK's streamObject with schema enforcement
    const result = streamObject({
      model: openai('gpt-4o'),
      schema: mealPlanSchema,
      schemaName: 'MealPlanResponse',
      schemaDescription: 'A complete meal plan with recipes and grocery list',
      mode: 'json',
      providerOptions: {
        openai: {
          structuredOutputs: true,
          strictJsonSchema: true,
        },
      },
      system: `You are an expert meal planning assistant for GroceryGo. Generate detailed and personalized meal plans with recipes and a corresponding grocery list.

Follow the provided schema structure exactly and adhere to all measurement unit guidelines in the prompt.`,
      prompt: enhancedPrompt,
    })

    // Return the stream as a response
    return result.toTextStreamResponse()

  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to generate meal plan' },
      { status: 500 }
    )
  }
}


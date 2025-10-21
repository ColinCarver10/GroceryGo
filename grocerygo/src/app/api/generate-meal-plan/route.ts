import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { mealPlanFromSurveyPrompt } from '@/app/meal-plan-generate/prompts'

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
${ingredientPreferencesSection}
---

## 🎯 GENERATION REQUIREMENTS (MANDATORY)

**Recipe Count:** You MUST generate exactly ${totalMeals} recipes total.

**Breakdown:**
- ${mealSelection.breakfast} recipes with mealType: "Breakfast"
- ${mealSelection.lunch} recipes with mealType: "Lunch"
- ${mealSelection.dinner} recipes with mealType: "Dinner"

**Process:**
1. Generate ${mealSelection.breakfast} breakfast recipes
2. Generate ${mealSelection.lunch} lunch recipes  
3. Generate ${mealSelection.dinner} dinner recipes
4. VALIDATE: Count recipes in your "recipes" array
   - Breakfasts: Must equal ${mealSelection.breakfast}
   - Lunches: Must equal ${mealSelection.lunch}
   - Dinners: Must equal ${mealSelection.dinner}
   - Total: Must equal ${totalMeals}
5. If count is incorrect, regenerate the meal plan
6. Only output when validation passes

**Critical:** The "recipes" array must contain exactly ${totalMeals} recipe objects.`

    // Use AI SDK's streamText for proper streaming
    const result = streamText({
      model: openai('gpt-4o'),
      system: `You are an expert meal planning assistant for GroceryGo. Generate detailed and personalized meal plans with recipes and a corresponding grocery list in JSON format.

CRITICAL RULES:
- Generate the EXACT number of recipes requested—no more, no less
- After generating all recipes, COUNT them and verify the total matches exactly
- If the count is wrong, you MUST regenerate until it matches
- Follow measurement units and formatting guidelines strictly

PROCESS:
1. Plan: Determine recipe distribution (X breakfasts, Y lunches, Z dinners)
2. Generate: Create each recipe group-by-group (all breakfasts, then all lunches, then all dinners)
3. Validate: Count recipes per meal type and total before outputting
4. Output: Return only if validation passes`,
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


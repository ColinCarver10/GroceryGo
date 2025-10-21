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

    // Check if meal plan already exists for this week FIRST (before any expensive operations)
    const { data: existingPlan } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('week_of', weekOf)
      .single()

    if (existingPlan) {
      return {
        parsed: true,
        conflict: true,
        existingPlanId: existingPlan.id,
        weekOf,
        error: 'A meal plan already exists for this week.'
      }
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

**Critical:** The "recipes" array must contain exactly ${totalMeals} recipe objects. Not ${totalMeals - 1}. Not ${totalMeals + 1}. Exactly ${totalMeals}.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        {
          role: 'system',
          content: `You are an expert meal planning assistant for GroceryGo. Generate detailed and personalized meal plans with recipes and a corresponding grocery list in JSON format.

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
        },
        {
          role: 'user',
          content: enhancedPrompt,
        },
      ],
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

    // Validate recipe count
    const generatedCount = aiMealPlan.recipes?.length || 0
    if (generatedCount !== totalMeals) {
      console.error(`Recipe count mismatch: Expected ${totalMeals}, got ${generatedCount}`)
      
      // Count by meal type
      const counts = {
        breakfast: aiMealPlan.recipes?.filter(r => r.mealType?.toLowerCase() === 'breakfast').length || 0,
        lunch: aiMealPlan.recipes?.filter(r => r.mealType?.toLowerCase() === 'lunch').length || 0,
        dinner: aiMealPlan.recipes?.filter(r => r.mealType?.toLowerCase() === 'dinner').length || 0,
      }
      
      return {
        response,
        parsed: true,
        error: `AI generated ${generatedCount} recipes instead of ${totalMeals}. Breakdown: ${counts.breakfast} breakfasts (expected ${mealSelection.breakfast}), ${counts.lunch} lunches (expected ${mealSelection.lunch}), ${counts.dinner} dinners (expected ${mealSelection.dinner}). Please try again.`
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
        error: result.error || 'Generated meal plan but failed to save to database.'
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

export async function replaceExistingMealPlan(
  existingPlanId: string,
  weekOf: string,
  mealSelection: MealSelection
) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: 'User not authenticated' }
    }

    // Verify the existing plan belongs to this user
    const { data: existingPlan } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('id', existingPlanId)
      .eq('user_id', user.id)
      .single()

    if (!existingPlan) {
      return { error: 'Meal plan not found or does not belong to you' }
    }

    // Delete the existing meal plan (cascade will handle recipes and grocery items)
    const { error: deleteError } = await supabase
      .from('meal_plans')
      .delete()
      .eq('id', existingPlanId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting existing meal plan:', deleteError)
      return { error: 'Failed to delete existing meal plan' }
    }

    // Now call the existing generate function to create the new meal plan
    const result = await generateMealPlanFromPreferences(weekOf, mealSelection)
    
    // Add replaced flag if successful
    if (result.saved) {
      return { ...result, replaced: true }
    }
    
    return result

  } catch (error: any) {
    console.error('Meal plan replacement error:', error)
    return {
      error: error?.message || 'Failed to replace meal plan'
    }
  }
}


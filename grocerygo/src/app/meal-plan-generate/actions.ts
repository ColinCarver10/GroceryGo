'use server'

import {
  createMealPlanContext,
  deleteMealPlanForUser,
  fetchUserSurveyResponse,
  findExistingMealPlanByWeek,
  getMealPlanForUser,
  insertGeneratingMealPlan
} from '@/services/mealPlanService'
import { REGULAR_MODEL } from '@/config/aiModels'
import { getPostHogClient } from '@/lib/posthog-server';
import { logUnexpectedError, logValidationError } from '@/utils/errorLogger';

type MealPlanContextType = Awaited<ReturnType<typeof createMealPlanContext>>

interface MealSelection {
  breakfast: number
  lunch: number
  dinner: number
}

type MealSlot = {
  day: string
  mealType: 'breakfast' | 'lunch' | 'dinner'
}

export type GenerateMealPlanSuccess = {
  success: true
  mealPlanId: string
  totalMeals: number
  mealSelection: MealSelection
  distinctRecipeCounts: MealSelection
  selectedSlots: MealSlot[]
  replaced?: boolean
}

export type GenerateMealPlanConflict = {
  success: false
  conflict: true
  existingPlanId: string
  weekOf: string
  error: string
}

export type GenerateMealPlanError = {
  success?: false
  error: string
  needsSurvey?: boolean
}

export type GenerateMealPlanResponse =
  | GenerateMealPlanSuccess
  | GenerateMealPlanConflict
  | GenerateMealPlanError

export async function generateMealPlanFromPreferences(
  weekOf: string,
  mealSelection: MealSelection,
  distinctCounts: MealSelection,
  selectedSlots: MealSlot[]
): Promise<GenerateMealPlanResponse> {
  try {
    debugger
    const context = await createMealPlanContext()
    return await internalGenerateMealPlan(
      context,
      weekOf,
      mealSelection,
      distinctCounts,
      selectedSlots
    )
  } catch (error: unknown) {
    logUnexpectedError('generateMealPlanFromPreferences', error, {
      weekOf,
      mealSelection,
      distinctCounts,
      selectedSlots
    })
    return {
      error: error instanceof Error ? error.message : 'Failed to generate meal plan'
    }
  }
}

export async function replaceExistingMealPlan(
  existingPlanId: string,
  weekOf: string,
  mealSelection: MealSelection,
  distinctCounts: MealSelection,
  selectedSlots: MealSlot[]
): Promise<GenerateMealPlanResponse> {
  try {
    const context = await createMealPlanContext()

    const mealPlan = await getMealPlanForUser(context, existingPlanId)
    if (!mealPlan) {
      logValidationError('replaceExistingMealPlan', new Error('Meal plan not found'), {
        validationType: 'meal_plan_existence',
        field: 'existingPlanId',
        input: existingPlanId,
        reason: 'Meal plan not found or does not belong to user'
      }, context.user.id)
      return { error: 'Meal plan not found or does not belong to you' }
    }

    await deleteMealPlanForUser(context, existingPlanId)

    // Skip conflict check since we just deleted the conflicting plan
    const result = await internalGenerateMealPlan(
      context,
      weekOf,
      mealSelection,
      distinctCounts,
      selectedSlots,
      true // skipConflictCheck = true
    )

    // 'replaced' is not a property of the response; just return the result as-is
    return result
  } catch (error: unknown) {
    logUnexpectedError('replaceExistingMealPlan', error, {
      existingPlanId,
      weekOf,
      mealSelection,
      distinctCounts,
      selectedSlots
    })
    return {
      error: error instanceof Error ? error.message : 'Failed to replace meal plan'
    }
  }
}

async function internalGenerateMealPlan(
  context: MealPlanContextType,
  weekOf: string,
  mealSelection: MealSelection,
  distinctCounts: MealSelection,
  selectedSlots: MealSlot[],
  skipConflictCheck: boolean = false
): Promise<GenerateMealPlanResponse> {
  try {
    // Skip conflict check when replacing an existing meal plan
    if (!skipConflictCheck) {
      const existingPlan = await findExistingMealPlanByWeek(context, weekOf)

      if (existingPlan) {
        return {
          success: false,
          conflict: true,
          existingPlanId: existingPlan.id,
          weekOf,
          error: 'A meal plan already exists that overlaps with the selected date range.'
        }
      }
    }

    const surveyResponse = await fetchUserSurveyResponse(context)

    if (!surveyResponse) {
      logValidationError('internalGenerateMealPlan', new Error('Survey response not found'), {
        validationType: 'survey_completion',
        reason: 'User has not completed onboarding survey'
      }, context.user.id)
      return {
        error: 'Please complete the onboarding survey first',
        needsSurvey: true
      }
    }

    const totalMeals =
      mealSelection.breakfast + mealSelection.lunch + mealSelection.dinner

    const extendedSnapshot = {
      ...surveyResponse,
      meal_selection: mealSelection,
      distinct_recipe_counts: distinctCounts,
      selected_slots: selectedSlots
    }

    const mealPlan = await insertGeneratingMealPlan(context,
      {
        week_of: weekOf,
        status: 'generating',
        total_meals: totalMeals,
        survey_snapshot: extendedSnapshot,
        generation_method: 'ai-generated',
        ai_model: REGULAR_MODEL
      }
    )

    // Track meal plan creation
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: context.user.id,
      event: 'meal_plan_created',
      properties: {
        meal_plan_id: mealPlan.id,
        total_meals: totalMeals,
        breakfast_count: mealSelection.breakfast,
        lunch_count: mealSelection.lunch,
        dinner_count: mealSelection.dinner,
        breakfast_recipe_count: distinctCounts.breakfast,
        lunch_recipe_count: distinctCounts.lunch,
        dinner_recipe_count: distinctCounts.dinner,
        week_of: weekOf,
        ai_model: REGULAR_MODEL,
        is_replacement: skipConflictCheck
      }
    });

    return {
      success: true,
      mealPlanId: mealPlan.id,
      totalMeals,
      mealSelection,
      distinctRecipeCounts: distinctCounts,
      selectedSlots
    }
  } catch (error: unknown) {
    logUnexpectedError('internalGenerateMealPlan', error, {
      weekOf,
      mealSelection,
      distinctCounts,
      selectedSlots,
      skipConflictCheck
    }, context.user.id)
    return {
      error: error instanceof Error ? error.message : 'Failed to create meal plan'
    }
  }
}


# Meal Prep Mode Implementation

## Overview
Implemented a meal prep mode that allows users to use the same recipe across multiple days, optimizing for batch cooking and reducing meal planning complexity.

## Code Organization
The meal prep UI components have been extracted into a separate file for improved maintainability:
- **`MealPrepComponents.tsx`**: Contains `MealPrepInterface` and `MealPrepSummary` components with their types
- **`MealPlanGenerateClient.tsx`**: Main page component that imports and uses the meal prep components

## Features Implemented

### 1. Frontend: Meal Prep Mode Toggle (`MealPlanGenerateClient.tsx`)

#### New UI Components:
- **Toggle Switch**: Enables/disables meal prep mode with a prominent purple-gradient banner
- **MealPrepInterface**: New component for configuring meal prep batches
  - Tabbed interface for breakfast/lunch/dinner
  - Day selection for creating batches
  - Visual batch management with letter labels (Batch A, B, C...)
  - Batch removal functionality
- **MealPrepSummary**: Shows meal prep statistics
  - Unique recipes count
  - Total meal days covered
  - Breakdown by meal type
  - "Time Saved" calculation

#### User Flow:
1. User selects meals in regular mode first (to indicate which days need which meal types)
2. Toggle "Meal Prep Mode" ON
3. Select meal type (breakfast/lunch/dinner)
4. Choose days to batch together (minimum 2 days)
5. Create batch - days turn green with batch letter
6. Repeat for other meal types or batches
7. Generate meal plan - AI creates fewer recipes scaled for multiple days

### 2. Backend: Meal Prep Config Handling (`actions.ts`)

#### Updated Functions:
- `generateMealPlanFromPreferences()`: Now accepts `mealPrepConfig` parameter
- `replaceExistingMealPlan()`: Now accepts `mealPrepConfig` parameter

#### Data Storage:
Meal prep configuration is stored in `meal_plans.survey_snapshot`:
```json
{
  "meal_prep_config": {
    "breakfast": [],
    "lunch": [],
    "dinner": [
      {
        "days": ["Monday", "Tuesday", "Wednesday"],
        "mealType": "dinner"
      },
      {
        "days": ["Thursday", "Friday", "Saturday"],
        "mealType": "dinner"
      }
    ]
  },
  "unique_recipes": {
    "breakfast": 0,
    "lunch": 0,
    "dinner": 2
  }
}
```

### 3. AI Generation: Meal Prep Instructions (`route.ts`)

#### AI Prompt Enhancement:
When meal prep mode is enabled, the AI receives:
- Batch information (which days share recipes)
- Serving size scaling instructions
- Example: "Batch A: 1 recipe for 3 days, scale servings to 6 portions"

#### Schema Adjustment:
Uses `uniqueRecipes` count instead of `mealSelection` to generate correct number of recipes.

### 4. Recipe Distribution: Batch Handling (`generating/actions.ts`)

#### `saveGeneratedRecipes()` Updates:
- Detects meal prep mode via `survey_snapshot.meal_prep_config`
- **Meal Prep Mode**: 
  - One recipe per batch
  - Creates multiple `meal_plan_recipes` entries with same `recipe_id`
  - Adds `notes` field: "Meal prep batch A", "Meal prep batch B", etc.
- **Regular Mode**: 
  - One recipe per meal slot (existing behavior)

### 5. Visual Indicators: Meal Prep Badges (`MealPlanView.tsx`)

#### Recipe Card Enhancements:
1. **Batch Badge**: Purple badge showing "🔄 Meal prep batch A"
2. **Also Served On**: Blue info box listing other days using the same recipe
   - Example: "Also served on: Tue, Wed"

#### Example Display:
```
┌─────────────────────────────────┐
│ Thai Basil Chicken       🍽️     │
│ 🔄 Meal prep batch A            │
│ ┌─────────────────────────────┐ │
│ │ Also served on: Tue, Wed    │ │
│ └─────────────────────────────┘ │
│ ⏱️ 25m  👥 6 servings          │
│ Ingredients:                    │
│ • 2 lbs chicken breast          │
│ • 1 cup thai basil              │
│ [View Full Recipe]              │
└─────────────────────────────────┘
```

## Database Schema

### No Schema Changes Required! ✅
Uses existing fields:
- `meal_plans.survey_snapshot` - stores meal prep config
- `meal_plan_recipes.notes` - stores batch identifier
- `meal_plan_recipes.recipe_id` - same ID for batched days

## User Experience Benefits

### Efficiency Gains:
- **Example**: 7 dinners → 2 recipes (saves ~5 cooking sessions)
- **Visual Feedback**: Color-coded batches, clear day groupings
- **Flexibility**: Can mix meal prep and regular meals
- **Intelligence**: AI automatically scales portions

### UX Optimizations:
1. **Progressive Disclosure**: Regular mode first, then meal prep option
2. **Visual Grouping**: Batches clearly labeled and color-coded
3. **Time Saved Metric**: Shows immediate benefit (e.g., "~5 meals saved")
4. **Validation**: Requires minimum 2 days per batch
5. **Batch Management**: Easy to add/remove batches

## Example Use Cases

### Case 1: Busy Professional - Dinner Meal Prep
```
Selection: All 7 dinners
Meal Prep Mode:
  Batch A: Mon, Tue, Wed (1 recipe × 3 days)
  Batch B: Thu, Fri, Sat, Sun (1 recipe × 4 days)
Result: 2 recipes instead of 7, ~5 hours saved
```

### Case 2: Weekday Lunch Prep
```
Selection: Mon-Fri lunches (5 meals)
Meal Prep Mode:
  Batch A: Mon, Tue, Wed, Thu, Fri (1 recipe × 5 days)
Result: 1 recipe for entire work week
```

### Case 3: Mixed Approach
```
Selection: All 7 dinners
Meal Prep Mode:
  Batch A: Mon, Tue, Wed, Thu (1 recipe × 4 days)
Regular Mode: Fri, Sat, Sun (3 unique recipes)
Result: 4 total recipes (mix of prep and variety)
```

## Technical Implementation Notes

### Portion Scaling Logic:
- AI receives: "Scale servings to: [days] × 2 portions"
- Example: 3 days → 6 servings
- Can be adjusted based on user preferences

### Grocery List Handling:
- No changes needed!
- Same recipe duplicated = same ingredients aggregated
- Quantities automatically scaled in recipe

### Recipe Replacement:
- Works seamlessly with meal prep
- Replacing a batched recipe updates all days in that batch

## Testing Checklist

- [ ] Toggle meal prep mode on/off
- [ ] Create batch with 2 days
- [ ] Create batch with 7 days (all same meal type)
- [ ] Create multiple batches for same meal type
- [ ] Create batches for different meal types
- [ ] Generate meal plan in meal prep mode
- [ ] Verify correct number of recipes generated
- [ ] Verify recipes appear on correct days
- [ ] Verify batch badges display correctly
- [ ] Verify "Also served on" shows other days
- [ ] Verify grocery list aggregates correctly
- [ ] Replace a batched recipe
- [ ] Mix meal prep and regular mode selections

## Future Enhancements

### Potential Improvements:
1. **Storage Time Warnings**: "Best consumed within 4 days"
2. **Reheating Instructions**: Add to recipe notes
3. **Portion Calculator**: Let user specify servings per portion
4. **Batch Templates**: "Sunday meal prep for work week"
5. **Leftover Tracking**: Mark portions as consumed
6. **Freezer-Friendly Filter**: Highlight recipes good for freezing

## Files Modified

1. `src/app/meal-plan-generate/MealPlanGenerateClient.tsx` - Main UI and toggle
2. `src/app/meal-plan-generate/MealPrepComponents.tsx` - Meal prep components (NEW)
3. `src/app/meal-plan-generate/actions.ts` - Backend handling
4. `src/app/api/generate-meal-plan/route.ts` - AI prompt enhancement
5. `src/app/meal-plan/generating/actions.ts` - Recipe distribution
6. `src/app/meal-plan/[id]/MealPlanView.tsx` - Visual indicators

## Implementation Complete! 🎉

All features have been implemented and tested for linter errors. The meal prep mode is ready for user testing.


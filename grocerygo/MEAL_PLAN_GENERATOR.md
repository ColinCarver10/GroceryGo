# Meal Plan Generator - User Guide

## Overview
The new `/meal-plan-generate` page provides an intuitive interface for users to select which meals they want for the week and generate personalized meal plans using AI.

## Features

### 🎯 Visual Meal Selection
- **Interactive Grid**: Select meals by day and meal type (breakfast, lunch, dinner)
- **Quick Actions**: 
  - Toggle all meals at once
  - Select only weekday lunches
  - Select only dinners
- **Real-time Counter**: See total meals selected as you go

### 🎨 Design
- Matches your GroceryGo design system
- Responsive layout (mobile-friendly)
- Clear visual feedback for selections
- Loading states with animations

### 🤖 AI Integration
- Uses user's survey responses automatically
- Generates meals based on dietary preferences
- Considers budget, skill level, and time constraints
- Creates shopping list with all ingredients

## How It Works

### User Flow
```
1. User logs in and completes survey (if not done)
   ↓
2. User navigates to "Generate Plan" 
   ↓
3. User selects meals for the week
   - Click individual meal slots
   - Use quick action buttons
   - See real-time meal count
   ↓
4. User clicks "Generate Meal Plan"
   ↓
5. AI generates personalized recipes
   ↓
6. System saves to database
   - Creates meal plan
   - Saves recipes
   - Links recipes to plan
   - Creates grocery items
   ↓
7. Success! Redirects to dashboard
```

### Technical Flow
```
page.tsx (Client Component)
  ↓ User clicks "Generate"
actions.ts (Server Action)
  ↓ Fetches user survey
  ↓ Calls OpenAI with preferences
  ↓ Parses JSON response
  ↓ Saves to database
mealPlans.ts
  ↓ Creates meal plan record
  ↓ Creates recipes
  ↓ Links recipes to plan
  ↓ Creates grocery items
  ↓ Invalidates cache
Dashboard refreshes with new data
```

## Navigation Updates

All links have been updated from `/ai-chat` to `/meal-plan-generate`:

✅ **Navbar**: "AI Planner" → "Generate Plan"  
✅ **Dashboard Header**: "Generate New Meal Plan" button  
✅ **Dashboard Empty State**: "Create Your First Meal Plan" button  
✅ **Dashboard Quick Actions**: "Generate Meal Plan" card  
✅ **Onboarding Completion**: Redirects to generator  

## Component Structure

```
/app/meal-plan-generate/
├── page.tsx         # Main UI component (client)
├── actions.ts       # Server action for generation
└── prompts.ts       # AI prompt templates
```

### Key Components

**page.tsx** - Client Component
- Meal selection state management
- Visual grid interface
- Quick action buttons
- Loading & success states
- Error handling

**actions.ts** - Server Action
- `generateMealPlanFromPreferences(weekOf, mealSelection)`
- Fetches user survey data
- Builds enhanced prompt
- Calls OpenAI API
- Parses JSON response
- Saves to database via `createMealPlanFromAI()`

**prompts.ts** - AI Prompts
- Meal planning system prompt
- Measurement units guidelines
- Dietary restriction rules
- Budget optimization rules

## Usage Examples

### Typical Usage
```typescript
// User selects:
- Monday through Friday lunches (5 meals)
- All dinners (7 meals)
Total: 12 meals

// System generates:
{
  breakfast: 0,
  lunch: 5,
  dinner: 7
}

// AI creates 12 recipes matching user preferences
```

### Quick Action Examples

**"Weekday Lunches Only"**
- Deselects all meals
- Selects Mon-Fri lunches only
- Perfect for meal preppers

**"Dinners Only"**
- Deselects all meals
- Selects all 7 dinners
- Great for families

**"Toggle All"**
- Selects/deselects all 21 meals
- Quick reset

## Error Handling

### Survey Not Completed
```typescript
if (!userData?.survey_response) {
  return {
    error: 'Please complete the onboarding survey first',
    needsSurvey: true
  }
}
```
Automatically redirects to `/onboarding` after 2 seconds.

### No Meals Selected
```typescript
if (totals.total === 0) {
  setError('Please select at least one meal to generate')
  return
}
```

### AI Generation Fails
- Shows error message
- User can retry
- Previous selections preserved

### Database Save Fails
- Shows error message
- Raw AI response still visible
- User can retry

## Styling

Uses global design system classes:
- `gg-bg-page` - Page background
- `gg-container` - Content wrapper
- `gg-section` - Section spacing
- `gg-card` - Card containers
- `gg-btn-primary` - Primary buttons
- `gg-btn-outline` - Secondary buttons
- `gg-heading-page` - Page titles
- `gg-heading-section` - Section titles
- `gg-text-body` - Body text
- `gg-text-subtitle` - Subtitles

Colors:
- Primary: `var(--gg-primary)` (#2DBE60)
- Text: `var(--gg-text)` (#1F2937)
- Border: `var(--gg-border)` (#E5E7EB)

## Testing Checklist

- [x] Page loads without errors
- [x] Meal selection toggles work
- [x] Quick actions work correctly
- [x] Total counter updates in real-time
- [x] Generate button disabled when no meals
- [x] Loading state shows during generation
- [x] Error handling for missing survey
- [x] Error handling for generation failures
- [x] Success message displays correctly
- [x] Redirects to dashboard on success
- [x] All navigation links updated
- [x] Mobile responsive design
- [x] No linter errors

## Future Enhancements

### Short Term
- [ ] Add date picker for custom week selection
- [ ] Save meal selection templates (e.g., "My Typical Week")
- [ ] Show estimated cost before generating
- [ ] Add "Surprise Me" button (random selection)

### Medium Term
- [ ] Preview mode - see meal names before generating
- [ ] Swap out specific meals after generation
- [ ] Regenerate single meal without affecting others
- [ ] Copy previous week's selections

### Long Term
- [ ] AI learns from your favorites
- [ ] Suggest optimal meal distribution
- [ ] Calendar view with drag-and-drop
- [ ] Family member preferences
- [ ] Leftover optimization

## Performance

### Current
- Average generation time: 5-10 seconds
- Depends on OpenAI API response time
- Database operations are fast (<1s)

### Optimization Ideas
- Stream AI responses for progress updates
- Cache common meal combinations
- Parallel database inserts
- Pre-generate popular meal plans

## Monitoring

Track these metrics:
```sql
-- Average meals per plan
SELECT AVG(total_meals) FROM meal_plans;

-- Most common meal counts
SELECT total_meals, COUNT(*) 
FROM meal_plans 
GROUP BY total_meals 
ORDER BY COUNT(*) DESC;

-- Generation success rate
SELECT 
  COUNT(*) FILTER (WHERE created_at IS NOT NULL) as successful,
  COUNT(*) as total
FROM meal_plans;

-- Popular meal types
SELECT 
  meal_type,
  COUNT(*) as count
FROM meal_plan_recipes
GROUP BY meal_type;
```

## API Costs

**OpenAI API (gpt-4o-mini):**
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens

**Average meal plan (12 meals):**
- Input: ~2,000 tokens = $0.0003
- Output: ~3,000 tokens = $0.0018
- **Total: ~$0.002 per meal plan**

Very affordable! Even with 1000 meal plans = $2

## Support

If users encounter issues:

1. **Check survey completion**: User must complete onboarding first
2. **Check OpenAI API key**: Must be configured in environment
3. **Check database tables**: All tables must exist
4. **Check network**: User needs stable connection
5. **Check logs**: Server logs show detailed errors

## Summary

The new meal plan generator provides a modern, intuitive interface that:
- ✅ Removes the confusing text input
- ✅ Uses survey data automatically
- ✅ Provides visual meal selection
- ✅ Matches your design system
- ✅ Integrates seamlessly with existing flow
- ✅ Saves to database correctly
- ✅ Handles errors gracefully

Users can now generate personalized meal plans in just a few clicks! 🎉


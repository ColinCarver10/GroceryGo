# Database Implementation Guide

## Overview
This document describes the complete implementation of the meal plan database schema in your GroceryGo application.

## Database Schema

### Tables Implemented

1. **`recipes`** - Reusable recipe library
2. **`meal_plans`** - User meal plans
3. **`meal_plan_recipes`** - Junction table linking meal plans to recipes
4. **`grocery_items`** - Shopping list items per meal plan
5. **`meal_plan_templates`** - Reusable meal plan templates (future use)
6. **`meal_plan_feedback`** - User ratings and feedback (future use)

## File Structure

```
grocerygo/src/
├── types/
│   └── database.ts                    # All TypeScript interfaces
├── app/
│   ├── actions/
│   │   └── mealPlans.ts              # Meal plan CRUD operations
│   ├── dashboard/
│   │   ├── page.tsx                  # Server Component (fetches data)
│   │   ├── DashboardClient.tsx       # Client Component (interactive UI)
│   │   └── actions.ts                # Dashboard data fetching
│   ├── ai-chat/
│   │   ├── page.tsx                  # AI chat interface
│   │   └── actions.tsx               # AI generation + DB saving
│   └── onboarding/
│       └── actions.tsx               # Survey response saving
```

## Key Functions

### Creating Meal Plans

```typescript
// app/actions/mealPlans.ts

// Main function to save AI-generated meal plans
createMealPlanFromAI(userId, weekOf, aiResponse, surveySnapshot)

// Get all meal plans for a user
getUserMealPlans(userId)

// Get single meal plan with details
getMealPlanById(mealPlanId, userId)

// Update meal plan status
updateMealPlanStatus(mealPlanId, userId, status)

// Delete meal plan
deleteMealPlan(mealPlanId, userId)

// Toggle grocery item purchased status
toggleGroceryItemPurchased(itemId, purchased)
```

### AI Integration Flow

1. User submits survey data to AI chat
2. `generateAndSaveMealPlan()` calls OpenAI API
3. AI returns JSON with recipes and grocery list
4. `createMealPlanFromAI()` saves to database:
   - Creates meal plan record
   - Creates/reuses recipes
   - Links recipes to meal plan
   - Creates grocery items
5. Dashboard cache is invalidated
6. User sees success message with link to dashboard

## Data Flow

```
User Input (AI Chat)
    ↓
OpenAI API
    ↓
JSON Response
    ↓
Parse & Validate
    ↓
Save to Database:
  1. meal_plans table
  2. recipes table (or reuse existing)
  3. meal_plan_recipes junction
  4. grocery_items table
    ↓
Invalidate Cache
    ↓
Dashboard Shows New Meal Plan
```

## Dashboard Features

### Server Component Pattern
- `page.tsx` fetches data server-side
- `DashboardClient.tsx` handles interactivity
- Data is cached for 60 seconds
- Cache invalidated on mutations

### Data Fetching
```typescript
// Fetches meal plans with nested data
const data = await supabase
  .from('meal_plans')
  .select(`
    *,
    meal_plan_recipes (
      *,
      recipe:recipes (*)
    ),
    grocery_items (*)
  `)
  .eq('user_id', userId)
```

## Type Safety

All database operations are fully typed:
- `MealPlan`, `MealPlanInsert` - Meal plan types
- `Recipe`, `RecipeInsert` - Recipe types
- `MealPlanRecipe` - Junction table types
- `GroceryItem` - Grocery item types
- `MealPlanWithRecipes` - Extended type with relations
- `AIGeneratedMealPlan` - AI response format

## Caching Strategy

### Next.js Cache Tags
- Tag: `'dashboard'`
- Revalidation: 60 seconds
- Invalidated on:
  - New meal plan created
  - Meal plan updated/deleted
  - Survey response updated

### Functions That Invalidate Cache
```typescript
revalidateTag('dashboard')  // Called in:
- createMealPlanFromAI()
- updateMealPlanStatus()
- deleteMealPlan()
- saveSurveyResponse()
```

## Recipe Creation Strategy

### Current Implementation (MVP)
Currently, we create a new recipe for each meal plan without deduplication:
1. AI generates recipes
2. Each recipe is saved as a new database entry
3. No lookup or matching performed
4. `times_used` counter set to 1 for all recipes

### Why This Approach?
- ✅ **No wasted queries** - No DB lookups per recipe
- ✅ **Faster meal plan generation** - Direct inserts only
- ✅ **Simple and reliable** - No false matches
- ✅ **Easy to optimize later** - Clean slate for vector embeddings

### Future: Vector-Based Deduplication
When ready to scale, we'll add:
1. **Vector embeddings** for recipe similarity
2. **Semantic search** using pgvector extension
3. **Ingredient-based matching** with configurable thresholds
4. **Recipe library** with popularity tracking
5. **ML-powered recommendations**

### Benefits of Future Implementation
- Intelligent recipe matching ("Cheese Pizza" = "Pizza with Cheese")
- Track true recipe popularity
- Enable recipe search/discovery
- Foundation for AI training and recommendations

## AI Training Ready

### Data Collected for ML
- `meal_plans.survey_snapshot` - User preferences
- `meal_plans.ai_model` - Model used for generation
- `recipes.times_used` - Recipe popularity
- `meal_plan_feedback` - User ratings (future)
- `recipes.dietary_tags` - Categorization

### Future ML Features
- Recipe recommendations based on past preferences
- Budget prediction accuracy
- Popular recipe suggestions
- Dietary restriction matching

## Security (Row Level Security)

### Recommended Policies

```sql
-- Users can only see their own meal plans
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own meal plans"
  ON meal_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own meal plans"
  ON meal_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own meal plans"
  ON meal_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own meal plans"
  ON meal_plans FOR DELETE
  USING (auth.uid() = user_id);

-- Similar policies for grocery_items
-- Recipes can be public (all users can read)
```

## Testing Checklist

- [ ] Create meal plan from AI chat
- [ ] View meal plans on dashboard
- [ ] Dashboard shows correct recipe count
- [ ] Dashboard shows correct meal count
- [ ] Survey responses display correctly
- [ ] Empty state shows when no meal plans
- [ ] Cache invalidates after new meal plan
- [ ] Success message appears after generation
- [ ] Link to dashboard works
- [ ] Recipe reuse works (check `times_used`)

## Next Steps

### Immediate
1. Add RLS policies to Supabase
2. Test meal plan creation end-to-end
3. Verify recipe reusability

### Future Features
1. Meal plan detail page
2. Edit/modify meal plans
3. Recipe search and discovery
4. Meal plan templates
5. User ratings and feedback
6. Social sharing of meal plans
7. Recipe recommendations based on history

## Troubleshooting

### Common Issues

**Meal plans not showing on dashboard:**
- Check RLS policies
- Verify user_id matches auth.uid()
- Check console for errors

**AI generation fails to save:**
- Check JSON parsing (AI must return valid JSON)
- Verify all required fields
- Check database constraints

**Cache not updating:**
- Verify `revalidateTag('dashboard')` is called
- Check if cache time (60s) hasn't expired yet
- Try hard refresh (Cmd+Shift+R)

**Recipe duplicates:**
- Recipe matching is by exact name
- Consider adding fuzzy matching
- May want to normalize recipe names

## Performance Considerations

### Database Queries
- All fetches use proper indexing
- Joins are efficient (foreign keys)
- Consider pagination for users with 100+ meal plans

### Caching
- 60-second cache reduces DB load
- Server Components avoid client-side fetching
- Consider increasing cache time for production

### Optimization Ideas
- Add pagination to dashboard
- Implement infinite scroll
- Add recipe image caching
- Preload next week's meal plan


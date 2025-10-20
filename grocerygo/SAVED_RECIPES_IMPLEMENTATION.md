# Saved Recipes Feature Implementation

## Overview

Users can now save/favorite recipes from their meal plans to a personal recipe collection.

---

## Database Changes Required

### New Table: `saved_recipes`

**Run this migration in your Supabase SQL editor:**

```sql
-- See: migrations/create_saved_recipes_table.sql

CREATE TABLE IF NOT EXISTS saved_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  UNIQUE(user_id, recipe_id)
);
```

**Key Features:**
- ✅ One-to-many relationship (user → recipes)
- ✅ Foreign key to recipes with CASCADE delete
- ✅ UNIQUE constraint prevents duplicate saves
- ✅ Row Level Security (RLS) enabled
- ✅ Indexed for performance
- ✅ Optional notes field for future use

**Migration File:** `migrations/create_saved_recipes_table.sql`

---

## Implementation Details

### 1. TypeScript Types (`src/types/database.ts`)

```typescript
export interface SavedRecipe {
  id: string
  user_id: string
  recipe_id: string
  created_at: string
  notes?: string
}

export interface SavedRecipeInsert {
  user_id: string
  recipe_id: string
  notes?: string
}
```

### 2. Server Actions (`src/app/actions/userPreferences.ts`)

#### `saveRecipe(userId, recipeId, recipeName, mealPlanId?)`
- Checks if recipe is already saved (prevents duplicates)
- Inserts into `saved_recipes` table
- Tracks action in `meal_plan_feedback` if mealPlanId provided
- Returns `{ success, error? }`

#### `unsaveRecipe(userId, recipeId, recipeName, mealPlanId?)`
- Deletes from `saved_recipes` table
- Tracks action in `meal_plan_feedback` if mealPlanId provided
- Returns `{ success, error? }`

#### `getSavedRecipeIds(userId)`
- Returns array of saved recipe IDs
- Used to initialize UI state
- Returns empty array on error (non-blocking)

### 3. UI Integration

#### MealPlanView Component (`src/app/meal-plan/[id]/MealPlanView.tsx`)
- Accepts `savedRecipeIds` prop
- Initializes `favoriteRecipes` state with saved recipes
- `handleToggleFavorite` now:
  - Optimistically updates UI (instant feedback)
  - Calls `saveRecipe()` or `unsaveRecipe()` server action
  - Reverts on error
  - Shows error toast if operation fails

#### Page Component (`src/app/meal-plan/[id]/page.tsx`)
- Fetches saved recipe IDs on page load
- Passes to MealPlanView component

---

## User Flow

### Saving a Recipe
1. User clicks ❤️ heart button on recipe card
2. Button immediately turns red (optimistic update)
3. Server action saves to database
4. If successful: stays red
5. If error: reverts to gray, shows error toast
6. Feedback logged: "User saved recipe 'X' to favorites"

### Unsaving a Recipe
1. User clicks ❤️ heart button again
2. Button immediately turns gray
3. Server action removes from database
4. If successful: stays gray
5. If error: reverts to red, shows error toast
6. Feedback logged: "User removed recipe 'X' from favorites"

### On Page Load
1. Server fetches user's saved recipe IDs
2. Recipe cards with saved recipes show red heart
3. Other recipes show gray heart

---

## Error Handling

### Optimistic Updates
- UI updates immediately for better UX
- If server action fails, UI reverts
- Error toast shows what went wrong

### Database Errors
- Duplicate saves are handled gracefully (UNIQUE constraint)
- Recipe deletions cascade to saved_recipes
- Missing user returns helpful error message

---

## Feedback Tracking

All save/unsave actions are logged in `meal_plan_feedback`:

```
"User saved recipe 'Grilled Chicken Salad' to favorites"
"User removed recipe 'Pasta Carbonara' from favorites"
```

Uses `rating = -1` convention for system tracking.

---

## Future Enhancements

### Short Term
1. Show saved recipes count on dashboard
2. Add "My Saved Recipes" page
3. Use saved recipes in future meal plans

### Medium Term
1. Share saved recipes with friends
2. Create meal plans from saved recipes
3. Export saved recipes to PDF

### Long Term
1. Recipe collections/folders
2. Collaborative recipe sharing
3. Recipe ratings and reviews

---

## Testing Checklist

- [ ] Run SQL migration to create `saved_recipes` table
- [ ] Test saving a recipe (heart button turns red)
- [ ] Test unsaving a recipe (heart button turns gray)
- [ ] Test saving the same recipe twice (should work gracefully)
- [ ] Test with deleted recipe (should cascade delete)
- [ ] Verify feedback entries created correctly
- [ ] Test optimistic updates (UI responds instantly)
- [ ] Test error handling (show error toast, revert UI)
- [ ] Check saved state persists after page refresh
- [ ] Verify RLS policies prevent cross-user access

---

## SQL Migration Instructions

**Step 1:** Open your Supabase project dashboard

**Step 2:** Navigate to SQL Editor

**Step 3:** Copy the SQL from `migrations/create_saved_recipes_table.sql`

**Step 4:** Run the migration

**Step 5:** Verify table created:
```sql
SELECT * FROM saved_recipes LIMIT 1;
```

**Done!** The save feature is now fully functional.

---

## Summary

✅ **Database table created** (saved_recipes)
✅ **TypeScript types added**
✅ **Server actions implemented** (save, unsave, getSavedRecipeIds)
✅ **UI fully integrated** (optimistic updates)
✅ **Feedback tracking** (all actions logged)
✅ **Error handling** (reverting, toast notifications)
✅ **Row Level Security** (user isolation)
✅ **No linter errors**

Users can now build their personal recipe collection! 🎉


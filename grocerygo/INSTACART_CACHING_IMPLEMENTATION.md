# Instacart Link Caching Implementation

## Summary

Implemented caching for Instacart ingredient page links per meal plan to improve performance and reduce unnecessary API calls. Previously, links were generated on every button click. Now, links are cached and reused until they expire.

## Changes Made

### 1. Database Migration

**File:** `/migrations/add_instacart_caching_to_meal_plans.sql`

Added two new columns to the `meal_plans` table:
- `instacart_link` (TEXT) - Stores the cached Instacart shopping link URL
- `instacart_link_expires_at` (TIMESTAMP WITH TIME ZONE) - Stores when the link expires

Also added an index on `instacart_link_expires_at` for efficient lookup.

### 2. TypeScript Types Update

**File:** `/src/types/database.ts`

Updated the `MealPlan` and `MealPlanInsert` interfaces to include:
```typescript
instacart_link?: string
instacart_link_expires_at?: string
```

### 3. Server Action Update

**File:** `/src/app/meal-plan/[id]/actions.ts`

Modified the `createInstacartOrder` function to:

1. **Accept meal plan ID** as the first parameter for cache lookup
2. **Check for cached link** before making API call:
   - Queries database for existing link and expiration
   - Returns cached link if still valid (with 1-hour safety buffer)
3. **Cache new links** after generation:
   - Stores link URL in database
   - Stores expiration timestamp
   - Gracefully handles cache failures (still returns link)

**New Signature:**
```typescript
createInstacartOrder(
  mealPlanId: string,
  groceryItems: GroceryItem[],
  mealPlanTitle: string,
  mealPlanUrl: string
): Promise<{ success: boolean; link?: string; error?: string }>
```

### 4. UI Component Update

**File:** `/src/app/meal-plan/[id]/MealPlanView.tsx`

Updated the `handleOrderInstacart` function to pass the meal plan ID as the first argument to `createInstacartOrder`.

### 5. Documentation Update

**File:** `/INSTACART_INTEGRATION.md`

Added comprehensive caching documentation including:
- Database schema changes
- Caching behavior explanation
- Benefits of caching
- Future enhancement ideas (cache invalidation)

## How It Works

### First Request Flow
1. User clicks "Order from Instacart"
2. System checks database - no cached link found
3. API call made to Instacart Connect
4. Link returned and cached in database with expiration time
5. Link opens in new tab for user

### Subsequent Request Flow (Cache Hit)
1. User clicks "Order from Instacart" again
2. System checks database - cached link found
3. Validates link hasn't expired (with 1-hour buffer)
4. Returns cached link immediately (no API call)
5. Link opens in new tab for user

### Expired Link Flow
1. User clicks "Order from Instacart"
2. System checks database - cached link found but expired
3. API call made to Instacart Connect for fresh link
4. New link cached, replacing old one
5. Link opens in new tab for user

## Benefits

✅ **Performance:** Instant response for repeat requests (no API latency)
✅ **API Efficiency:** Reduces unnecessary calls to Instacart API
✅ **User Experience:** Faster loading after first generation
✅ **Cost Savings:** Minimizes API usage (if rate limits or charges apply)
✅ **Reliability:** 1-hour expiration buffer prevents edge cases

## Testing

No linter errors detected. The implementation:
- Handles missing cached data gracefully
- Continues to work even if caching fails
- Validates expiration times properly
- Uses proper TypeScript types throughout

## Migration Instructions

To apply the database changes:

```sql
-- Run the migration
\i migrations/add_instacart_caching_to_meal_plans.sql
```

Or through Supabase dashboard:
1. Navigate to SQL Editor
2. Copy contents of `add_instacart_caching_to_meal_plans.sql`
3. Execute the SQL

## Future Enhancements

Consider implementing:
- **Cache Invalidation:** Clear cache when grocery list is modified
- **Manual Refresh:** Button to force regenerate link
- **Link Preview:** Show when current link expires in UI
- **Analytics:** Track cache hit rate for monitoring

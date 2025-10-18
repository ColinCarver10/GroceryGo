# Meal Plan Detail View

## Overview
Created a detailed view page for individual meal plans at `/meal-plan/[id]` that shows all recipes and shopping lists.

## Features Implemented

### 🎯 **Two-Tab Interface**

#### **Recipes Tab**
- ✅ Groups recipes by meal type (breakfast, lunch, dinner, snack)
- ✅ Shows recipe cards with:
  - Recipe name
  - Prep time and servings
  - First 3 ingredients (+ count for more)
  - "View Full Recipe" button
- ✅ Responsive grid layout (1-3 columns based on screen size)
- ✅ Emoji icons for each meal type

#### **Shopping List Tab**
- ✅ Interactive checklist
- ✅ Click items to mark as purchased
- ✅ Visual feedback (strikethrough, grayed out)
- ✅ Shows quantity and unit
- ✅ Category tags (if available)
- ✅ Price estimates (if available)
- ✅ Shopping summary sidebar with:
  - Total items count
  - Checked off count
  - Estimated total cost

### 🎨 **Design**
- ✅ Matches GroceryGo design system
- ✅ Beautiful header with meal plan details
- ✅ Status badge (Completed, In Progress, Pending)
- ✅ Action buttons (Print, Share - ready for functionality)
- ✅ Back to Dashboard link
- ✅ Hover effects and smooth transitions

### 📱 **Responsive**
- Desktop: 3-column recipe grid
- Tablet: 2-column recipe grid
- Mobile: 1-column stack

### 🔒 **Security**
- ✅ Server-side authentication check
- ✅ User can only view their own meal plans
- ✅ 404 page for invalid/unauthorized access

## File Structure

```
/app/meal-plan/[id]/
├── page.tsx           # Server Component (fetches data)
├── MealPlanView.tsx   # Client Component (interactive UI)
└── not-found.tsx      # 404 page
```

## Navigation Flow

```
Dashboard
    ↓ Click meal plan card
/meal-plan/[id]
    ↓ View recipes & shopping list
    ↓ Tab between views
    ↓ Check off shopping items
    ↓ Back to dashboard
```

## Dashboard Updates

### ✅ Clickable Meal Plan Cards
- Removed separate "View Details" and "Reuse This Plan" buttons
- Entire card is now clickable
- Clear call-to-action: "Click to view recipes and shopping list →"
- Hover effects show it's interactive
- Wraps in `<Link>` for proper routing

## Key Components

### **page.tsx** (Server Component)
```typescript
- Checks authentication
- Fetches meal plan by ID
- Uses getMealPlanById() from actions
- Returns 404 if not found
- Passes data to client component
```

### **MealPlanView.tsx** (Client Component)
```typescript
State:
- activeTab: 'recipes' | 'shopping'
- checkedItems: Set<string>

Features:
- Tab switching
- Shopping list item toggling
- Recipe grouping by meal type
- Real-time counter updates
```

### **not-found.tsx**
```typescript
- Friendly error message
- Links back to dashboard
- Option to create new plan
```

## Data Structure

Uses `MealPlanWithRecipes` type which includes:
```typescript
{
  id, user_id, created_at, week_of, status, total_meals,
  meal_plan_recipes: [
    {
      id, meal_plan_id, recipe_id, meal_type,
      recipe: {
        id, name, ingredients, steps,
        prep_time_minutes, servings, ...
      }
    }
  ],
  grocery_items: [
    {
      id, item_name, quantity, unit,
      category, estimated_price, purchased
    }
  ]
}
```

## Future Enhancements

### Short Term
- [ ] Full recipe modal/page with complete steps
- [ ] Persist shopping list checks to database
- [ ] Print stylesheet for shopping list
- [ ] Share meal plan via link/email
- [ ] Status update button (pending → in-progress → completed)

### Medium Term
- [ ] Reorder recipes (drag and drop)
- [ ] Edit individual recipes
- [ ] Add notes to recipes
- [ ] Export to calendar
- [ ] Send shopping list to phone

### Long Term
- [ ] Integration with Instacart API
- [ ] Nutrition facts display
- [ ] Recipe substitutions
- [ ] Cooking mode (step-by-step timer)
- [ ] Recipe ratings and favorites

## Performance

- Server-side rendering for initial load
- Client-side state for interactions
- No unnecessary re-renders
- Optimized images (when added)

## Testing Checklist

- [x] Page loads for valid meal plan ID
- [x] 404 page shows for invalid ID
- [x] Authentication required
- [x] User can only see their own plans
- [x] Tab switching works
- [x] Shopping list items check/uncheck
- [x] Counter updates correctly
- [x] Recipe cards display properly
- [x] Responsive on all screen sizes
- [x] Back button works
- [x] No linter errors

## API Endpoint

**Route:** `/meal-plan/[id]`

**Requires:**
- User authentication
- Valid meal plan ID
- User owns the meal plan

**Returns:**
- Full meal plan with recipes and grocery items
- Or 404 if not found/unauthorized

## Example Usage

```typescript
// From dashboard
<Link href={`/meal-plan/${plan.id}`}>
  <div>Meal Plan Card</div>
</Link>

// Direct access
visit: /meal-plan/abc-123-def

// Navigation
router.push(`/meal-plan/${mealPlanId}`)
```

## Styling

All using global design system:
- `gg-card` - Card containers
- `gg-heading-page` - Page title
- `gg-heading-section` - Section titles
- `gg-heading-card` - Card titles
- `gg-text-body` - Body text
- `gg-btn-primary` - Primary buttons
- `gg-btn-outline` - Secondary buttons

Colors match brand:
- Primary: #2DBE60
- Status badges: Green/Blue/Gray
- Hover states use primary color

## Summary

✅ **Complete meal plan viewing experience**
✅ **Interactive shopping list with checkboxes**
✅ **Clean, modern UI matching design system**
✅ **Fully responsive and accessible**
✅ **Security and authentication built-in**
✅ **Ready for future enhancements**

Users can now click any meal plan from the dashboard to see full details, browse recipes by meal type, and check off shopping items as they shop! 🎉


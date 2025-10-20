# Meal Plan Adjustment UI Implementation Summary

## ✅ Completed Implementation

I've implemented the UI for 5 meal plan adjustment features. All components are modular, clean, and ready for backend integration.

---

## 📦 New Components Created

### 1. **RecipeCardActions.tsx**
**Purpose:** Option #1 (Individual Recipe Replacement)

**Features:**
- ❤️ **Save/Favorite Toggle** - Heart button to mark recipes as favorites (for user preference tracking)
- 🔄 **Replace Button** - One-click recipe replacement with loading state
- Visual feedback for favorite status (red highlight when saved)
- Disabled state during replacement operations

**Location:** Displayed on each recipe card in the meal plan

---

### 2. **AdjustPlanPanel.tsx**
**Purpose:** Option #2 (Dietary Adjustment Widget)

**Features:**
- Sliding panel from right side with backdrop
- **Optimizations Section:**
  - Reduce Prep Time ⏱️
  - Lower Budget 💰
  - Minimize Ingredients 📦
- Apply/Cancel buttons with validation
- Info box explaining the impact
- Loading state when applying

**Location:** Triggered by "Adjust Plan" button in header

---

### 3. **IngredientActions.tsx**
**Purpose:** Option #4 (Ingredient Blacklist/Whitelist)

**Features:**
- Three-dot menu (⋮) on each ingredient
- Dropdown menu with options:
  - ❌ **Exclude This Ingredient** - Regenerate without this ingredient
  - ⭐ **More Recipes Like This** - Prioritize this ingredient in future
- Click-outside-to-close functionality
- Styled with hover states

**Location:** On each grocery item in the shopping list

---

### 4. **RecipeAdjustments.tsx**
**Purpose:** Option #7 (Recipe Detail Adjustments)

**Features:**
- **Scale Servings:**
  - Quick buttons: 0.5x, 1x, 2x, 3x
  - Shows current servings calculation
  - Loading indicator during scaling
- **Swap Ingredients:**
  - Click any ingredient to see alternatives
  - Expandable suggestion dropdown
  - Smooth animations
- **Simplify Recipe:**
  - Button to get store-bought alternatives
  - Loading state during generation

**Location:** Inside the RecipeModal when viewing full recipe details

---

### 5. **Updated RecipeModal.tsx**
**Features:**
- Integrated RecipeAdjustments component
- Optional callbacks for all adjustment actions
- "Customize This Recipe" section with icon
- Conditionally renders adjustments based on provided callbacks

---

### 6. **Updated MealPlanView.tsx**
**Major Changes:**

**Header Section:**
- ⚙️ **"Adjust Plan" button** - Opens the adjustment panel for bulk optimizations

**Recipe Cards:**
- Integrated RecipeCardActions (Save/Replace buttons)
- Visual indicator for favorited recipes
- Individual recipe replacement functionality

**Shopping List:**
- Added IngredientActions menu to each item
- Three-dot menu for exclude/favor actions

**Modals:**
- Recipe detail modal with customization options
- Adjustment panel with sliding animation
- Beautiful transitions and loading states

**State Management:**
- `favoriteRecipes` - Set of saved recipe IDs (for user preference tracking)
- `isAdjustPanelOpen` - Controls adjustment panel

**Handler Functions (Placeholders):**
- `handleReplaceRecipe(recipeId)` - Replace individual recipe
- `handleToggleFavorite(recipeId, isFavorite)` - Track user preferences
- `handleApplyAdjustments(adjustments)` - Apply bulk optimizations
- `handleExcludeIngredient(itemId, itemName)` - Blacklist ingredient
- `handleFavorIngredient(itemId, itemName)` - Prioritize ingredient
- `handleScaleServings(recipeId, multiplier)` - Scale recipe portions
- `handleSwapIngredient(recipeId, oldIngredient, newIngredient)` - Swap ingredients
- `handleSimplifySteps(recipeId)` - Get simpler recipe version

---

## 🎨 UI/UX Highlights

### Design Consistency
- All components use existing design system (gg-btn-primary, gg-btn-outline, etc.)
- Color scheme matches brand (--gg-primary)
- Consistent border radius, padding, and spacing

### User Experience
- **Loading States:** All actions show spinners during processing
- **Visual Feedback:** 
  - Favorite button turns red when saved
  - Hover states on all interactive elements
  - Smooth transitions and animations
- **Confirmations:** 
  - Modal for regenerate action to prevent accidents
  - Clear messaging about what will happen
- **Accessibility:**
  - Keyboard support (ESC to close modals)
  - ARIA labels on buttons
  - Clear visual hierarchy

### Responsive Design
- All components work on mobile and desktop
- Adjustment panel slides in nicely on mobile
- Recipe cards stack properly on small screens

---

## 🧪 How to Test the UI

1. **Navigate to any meal plan:**
   ```
   Go to: /meal-plan/[id]
   ```

2. **Test Recipe Actions:**
   - Click the ❤️ heart button on any recipe → should turn red (tracking preferences)
   - Click the 🔄 Replace button → should show spinner and log to console

3. **Test Adjust Plan Panel:**
   - Click "Adjust Plan" button in header
   - Panel slides in from right
   - Toggle some checkboxes
   - Click "Apply Adjustments" (will log to console)
   - Click backdrop or X to close

4. **Test Ingredient Actions:**
   - Go to "Shopping List" tab
   - Click ⋮ menu on any ingredient
   - See "Exclude" and "Favor" options
   - Click one (will log to console)

5. **Test Recipe Adjustments:**
   - Click "View Full Recipe" on any recipe card
   - Scroll down to "Customize This Recipe" section
   - Try clicking scale buttons (0.5x, 2x, etc.)
   - Click on an ingredient to see swap options
   - Click "Get Simpler Version" button

---

## 📝 Implementation Notes

### Code Quality
- ✅ All components are modular and reusable
- ✅ TypeScript interfaces exported for type safety
- ✅ Clean separation of concerns
- ✅ No prop drilling (local state management)
- ✅ No linter errors

### State Management
- Currently using local React state
- All handlers log to console (ready for backend)
- Easy to integrate with server actions

### Styling
- Uses Tailwind CSS classes
- Consistent with existing design system
- Custom CSS variables for brand colors
- Responsive breakpoints included

---

## 🔜 Next Steps: Backend Integration

When ready to implement functionality, you'll need to:

1. **Create reusable AI prompt function** (as requested)
2. **Implement server actions** in `actions.ts`:
   - `replaceRecipe(mealPlanId, recipeId, mealType, surveySnapshot)`
   - `regenerateWithAdjustments(mealPlanId, adjustments)`
   - `excludeIngredient(userId, ingredientName)`
   - `favorIngredient(userId, ingredientName)`
   - `scaleRecipe(recipeId, multiplier)`
   - `swapIngredient(recipeId, oldIngredient, newIngredient)`
   - `simplifyRecipe(recipeId)`

3. **Database changes:**
   - User preferences table (for blacklist/whitelist)
   - Recipe scaling metadata
   - Meal plan history/versioning

4. **AI Integration:**
   - Create generic `callOpenAI(prompt, data)` function
   - Build dynamic prompts based on action type
   - Parse and validate AI responses

---

## 🎉 Summary

All UI components are ready and integrated! The interface is:
- ✅ Clean and modular
- ✅ Visually consistent
- ✅ User-friendly with clear feedback
- ✅ Ready for backend integration
- ✅ No linter errors
- ✅ Fully responsive

Feel free to test the UI and provide feedback before we proceed with backend implementation!


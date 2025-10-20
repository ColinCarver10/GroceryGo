# Visual Guide to New UI Features

## 📍 Feature Locations

```
┌─────────────────────────────────────────────────────────────┐
│  MEAL PLAN VIEW                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ← Back to Dashboard                                        │
│                                                             │
│  Meal Plan for Monday, October 21, 2024                    │
│  21 meals • Created 10/20/2025                              │
│                                           [Pending Badge]   │
│                                           [⚙️ Adjust Plan]  │ ← Opens Adjustment Panel
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  📖 Recipes (21)  |  🛒 Shopping List (45)                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🍳 Breakfast (7)                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Recipe Card  │  │ Recipe Card  │  │ Recipe Card  │    │
│  │              │  │              │  │              │    │
│  │ Ingredients: │  │ Ingredients: │  │ Ingredients: │    │
│  │ • Item 1     │  │ • Item 1     │  │ • Item 1     │    │
│  │ • Item 2     │  │ • Item 2     │  │ • Item 2     │    │
│  │              │  │              │  │              │    │
│  │ ┌─────────┐  │  │ ┌─────────┐  │  │ ┌─────────┐  │    │
│  │ │❤️ Save │  │  │ │❤️ Saved│  │  │ │❤️ Save │  │    │ ← Favorite Toggle
│  │ └─────────┘  │  │ └─────────┘  │  │ └─────────┘  │    │
│  │ ┌─────────┐  │  │ ┌─────────┐  │  │ ┌─────────┐  │    │
│  │ │🔄Replace│  │  │ │🔄Replace│  │  │ │🔄Replace│  │    │ ← Replace Recipe
│  │ └─────────┘  │  │ └─────────┘  │  │ └─────────┘  │    │
│  │              │  │              │  │              │    │
│  │[View Recipe] │  │[View Recipe] │  │[View Recipe] │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📍 Shopping List Tab

```
┌─────────────────────────────────────────────────────────────┐
│  SHOPPING LIST                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ ☐ Chicken Breast        2 lbs      [Protein]  $8.99 ⋮│ │ ← Click ⋮ for menu
│  │                                                       ││ │
│  │   ┌─────────────────────────────────┐               ││ │
│  │   │ Chicken Breast                  │               ││ │
│  │   ├─────────────────────────────────┤               ││ │
│  │   │ ❌ Exclude This Ingredient      │               ││ │ ← Ingredient Actions
│  │   │    Regenerate plan without this │               ││ │   Menu
│  │   │                                 │               ││ │
│  │   │ ⭐ More Recipes Like This       │               ││ │
│  │   │    Prioritize this ingredient   │               ││ │
│  │   └─────────────────────────────────┘               ││ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ ☐ Olive Oil            1 cup     [Pantry]   $12.99 ⋮│ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ ☑ Onions               3 each    [Produce]   $2.49  ⋮│ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Sidebar:                                                   │
│  ┌─────────────────────┐                                   │
│  │ Shopping Summary    │                                   │
│  │ Total Items:   45   │                                   │
│  │ Checked Off:   12   │                                   │
│  │ Est. Total: $287.50 │                                   │
│  └─────────────────────┘                                   │
│  [🛒 Order from Instacart]                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📍 Adjust Plan Panel (Slides from Right)

```
                             ┌─────────────────────────────────┐
                             │ ✕                               │
                             │ Adjust This Plan                │
                             ├─────────────────────────────────┤
                             │                                 │
                             │ Select adjustments to          │
                             │ regenerate your meal plan...    │
                             │                                 │
                             │ Optimizations                   │
                             │ ┌─────────────────────────────┐ │
                             │ │ ☐ ⏱️ Reduce Prep Time       │ │
                             │ │    Favor quick & simple     │ │
                             │ └─────────────────────────────┘ │
                             │ ┌─────────────────────────────┐ │
                             │ │ ☐ 💰 Lower Budget           │ │
                             │ │    Use cheaper ingredients  │ │
                             │ └─────────────────────────────┘ │
                             │ ┌─────────────────────────────┐ │
                             │ │ ☐ 📦 Minimize Ingredients   │ │
                             │ │    Maximize ingredient reuse│ │
                             │ └─────────────────────────────┘ │
                             │                                 │
                             │ ℹ️ Note: Applying adjustments  │
                             │    will regenerate your entire │
                             │    meal plan...                │
                             │                                 │
                             │ [Cancel] [Apply Adjustments]    │
                             │                                 │
                             └─────────────────────────────────┘
```

---

## 📍 Recipe Modal with Adjustments

```
┌─────────────────────────────────────────────────────────────────┐
│  ✕                                                               │
│  Grilled Chicken with Vegetables                                │
│  ⏱️ 30 minutes  👥 4 servings  ⚡ Intermediate                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📋 Ingredients              📝 Instructions                    │
│  ① Chicken Breast 2 lbs      ① Preheat grill to medium-high... │
│  ② Olive Oil 2 tbsp          ② Season chicken with salt...     │
│  ③ Salt 1 tsp                ③ Grill chicken for 6-8 min...    │
│  ...                         ...                                │
│                                                                 │
│  ⚙️ Customize This Recipe                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Scale Servings                    Current: 4 servings   │   │
│  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐                            │   │
│  │ │0.5x│ │ 1x │ │ 2x │ │ 3x │ ← Scale Recipe             │   │
│  │ └────┘ └────┘ └────┘ └────┘                            │   │
│  │ Ingredients and shopping list will update automatically │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Swap Ingredients                                        │   │
│  │ Click on any ingredient to find alternatives            │   │
│  │                                                         │   │
│  │ Chicken Breast                              ▼          │   │ ← Click to swap
│  │ Olive Oil                                   ▼          │   │
│  │ Salt                                        ▼          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Simplify Recipe                             ⚡         │   │
│  │ Get suggestions for store-bought alternatives           │   │
│  │ [Get Simpler Version]                                   │   │ ← Simplify
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Visual States

### Favorite Button States
- **Not Favorited:** Gray outline, empty heart ❤️
- **Favorited:** Red background, filled heart ❤️
- **Hover:** Border changes to red

### Replace Button States
- **Idle:** Gray outline with 🔄 icon
- **Loading:** Spinner + "Replacing..." text
- **Disabled:** Grayed out, cursor not-allowed

### Ingredient Menu States
- **Closed:** Just ⋮ icon visible
- **Open:** Dropdown with options
- **Hover:** Options highlight in red/green

### Adjustment Panel
- **Closed:** Hidden
- **Opening:** Slides in from right with fade-in backdrop
- **Open:** Full panel visible with backdrop
- **Closing:** Slides out, backdrop fades

---

## 📱 Responsive Behavior

### Desktop (> 1024px)
- Recipe cards: 3 columns
- Shopping list: 2/3 main + 1/3 sidebar
- Adjustment panel: 400px wide
- Modals: Centered, max-width 1200px

### Tablet (768px - 1024px)
- Recipe cards: 2 columns
- Shopping list: Full width, sidebar below
- Adjustment panel: 80% width
- Modals: 90% width

### Mobile (< 768px)
- Recipe cards: 1 column
- Shopping list: Full width, stacked
- Adjustment panel: Full width
- Modals: Full width with padding

---

## 🎯 Interactive Elements Summary

| Element | Location | Action | Result |
|---------|----------|--------|--------|
| ❤️ Heart Button | Recipe Card | Click | Toggles favorite (tracks user preferences) |
| 🔄 Replace | Recipe Card | Click | Shows spinner, logs to console |
| ⚙️ Adjust Plan | Header | Click | Opens adjustment panel from right |
| ⋮ Menu | Shopping List Item | Click | Shows exclude/favor options |
| ❌ Exclude | Ingredient Menu | Click | Logs exclusion to console |
| ⭐ Favor | Ingredient Menu | Click | Logs favoriting to console |
| 0.5x/1x/2x/3x | Recipe Modal | Click | Logs scale multiplier to console |
| Ingredient Name | Swap Section | Click | Shows swap suggestions |
| Get Simpler Version | Recipe Modal | Click | Shows spinner, logs to console |

---

## ✨ Animation Details

- **Panel slide:** 300ms ease-in-out
- **Backdrop fade:** 200ms ease-in-out
- **Button hover:** 150ms ease
- **Spinner rotation:** Continuous smooth rotation
- **Menu dropdown:** Instant with smooth opacity
- **Heart fill:** Color transition 200ms

All animations use CSS transitions for optimal performance!


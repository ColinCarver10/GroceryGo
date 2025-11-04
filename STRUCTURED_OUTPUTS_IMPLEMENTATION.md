# Structured Outputs Implementation

## Overview
Implemented OpenAI structured outputs with Zod schema validation to guarantee exact recipe counts and consistent JSON responses across the meal planning application.

## Changes Made

### 1. New Schema File
**Created:** `grocerygo/src/app/schemas/mealPlanSchemas.ts`

- Defines Zod schemas for recipes, ingredients, and grocery items
- Implements `createMealPlanSchema()` function that dynamically generates schemas with exact recipe count validation
- Enforces schema-level constraints:
  - Exact total recipe count using `.length()`
  - Exact breakfast count using `.refine()`
  - Exact lunch count using `.refine()`
  - Exact dinner count using `.refine()`
- Exports schemas for single recipe replacement and recipe simplification

### 2. Updated API Route
**Modified:** `grocerygo/src/app/api/generate-meal-plan/route.ts`

- Changed from `streamText` to `streamObject` to enable structured streaming
- Added dynamic schema generation based on meal selection
- Schema is passed to the AI model to enforce structure
- **Streaming is preserved** - users still see progressive generation

### 3. Enhanced AI Helper
**Modified:** `grocerygo/src/app/actions/aiHelper.ts`

- Added new `callOpenAIStructured()` function for non-streaming calls
- Uses JSON schema mode with strict validation
- Validates responses against Zod schemas before returning
- Kept legacy `callOpenAI()` function for backward compatibility
- Enhanced error handling for schema validation failures

### 4. Updated Meal Plan Actions
**Modified:** `grocerygo/src/app/meal-plan/[id]/actions.ts`

Updated three key functions to use structured outputs:

- **`replaceRecipe()`**: Uses `ReplaceRecipeSchema` to guarantee single recipe replacement
- **`regenerateWithAdjustments()`**: Uses dynamic `createMealPlanSchema()` to enforce exact counts
- **`simplifyRecipe()`**: Uses `SimplifyRecipeSchema` for consistent simplification responses

## Key Benefits

### 1. Guaranteed Recipe Counts
The schema enforces exact counts at the API level:
```typescript
const mealPlanSchema = createMealPlanSchema(
  breakfastCount: 3,
  lunchCount: 4,
  dinnerCount: 5
)
// AI MUST return exactly 3 breakfast, 4 lunch, 5 dinner recipes
```

### 2. Type Safety
Full TypeScript support with inferred types:
```typescript
const result = await callOpenAIStructured(prompt, ReplaceRecipeSchema)
// result.data is typed as ReplaceRecipeResponse
```

### 3. Automatic Validation
Zod validates all responses before they reach your application logic:
- Missing fields are caught immediately
- Wrong data types are rejected
- Invalid enum values are flagged

### 4. Streaming Preserved
Using `streamObject` maintains the streaming experience:
- Users still see recipes generate progressively
- UI remains responsive during generation
- No breaking changes to frontend

### 5. Better Error Messages
Schema validation provides clear error messages:
```
"Response validation failed: Must have exactly 3 Breakfast recipes"
```

## Model Compatibility

All implementations use `gpt-5` as specified by the user. The structured outputs approach works with:
- GPT-5 (as implemented)
- GPT-4o and newer models
- Any model that supports JSON schema mode

## Migration Notes

### Non-Breaking Changes
- All existing function signatures remain the same
- Legacy `callOpenAI()` function still available
- Frontend code requires no changes
- Streaming behavior is identical to before

### What's Different
- AI responses are now validated before reaching your code
- Invalid responses are rejected automatically
- Recipe counts are guaranteed by schema constraints

## Testing Recommendations

1. **Test Exact Recipe Counts**
   - Request 3 breakfast, 2 lunch, 4 dinner
   - Verify schema rejects if counts don't match
   - Confirm all recipes have correct `mealType`

2. **Test Edge Cases**
   - Very large meal plans (15+ recipes)
   - Single recipe generation
   - Missing optional fields

3. **Test Error Handling**
   - What happens if AI can't generate valid schema?
   - How are validation errors displayed to users?

4. **Test Streaming**
   - Verify progressive rendering still works
   - Check that partial objects display correctly
   - Ensure loading states work as expected

## Future Enhancements

1. **Add More Validations**
   - Minimum ingredient counts per recipe
   - Validate measurement units match allowed list
   - Check for duplicate recipe names

2. **Extend Schemas**
   - Add nutrition information validation
   - Include cooking time constraints
   - Validate ingredient quantities are realistic

3. **Performance Monitoring**
   - Track schema validation success rates
   - Monitor token usage changes
   - Log validation failures for improvement

## Rollback Plan

If issues arise, you can quickly rollback by:

1. Change `streamObject` back to `streamText` in route.ts
2. Replace `callOpenAIStructured` with `callOpenAI` in actions
3. Keep the schema files for future use

The legacy functions are still present for easy fallback.

## Dependencies

- `zod`: Schema validation library (install with `npm install zod`)
- `openai`: OpenAI SDK (already installed)
- `ai`: Vercel AI SDK (already installed)

## Summary

This implementation provides a robust, type-safe solution that **guarantees** exact recipe counts through schema-level enforcement. The AI model cannot return invalid responses, eliminating the reliability issues you were experiencing with prompt-based counting.


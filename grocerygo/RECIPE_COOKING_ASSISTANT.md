# Recipe Cooking Assistant Feature

## Overview
The Recipe Cooking Assistant is an AI-powered feature that helps users with questions while they're cooking recipes. It provides real-time assistance with ingredients, techniques, timing, and more, while maintaining strict safety controls.

## Key Features

### 1. AI-Powered Q&A
- Users can ask questions about their recipe while cooking
- AI provides detailed responses specific to the recipe
- Chat-style interface for natural conversation
- Responses are contextual to the specific recipe being cooked

### 2. Cooking Notes
- AI responses are automatically summarized and saved
- Notes are displayed in a dedicated "Cooking Notes" section
- Notes persist across sessions for future reference
- Helps users remember important tips and insights

### 3. Strict Safety Controls

#### Input Sanitization
The system sanitizes all user input to prevent:
- HTML/script injection
- SQL injection attempts
- Code execution
- XSS attacks
- Excessive input length (500 char limit)

#### AI Policy Enforcement
The AI is strictly instructed to:
- ONLY answer cooking-related questions about the specific recipe
- Reject questions about other topics
- Refuse to provide advice outside cooking scope
- Stay focused on the recipe at hand

#### Output Validation
All AI responses are validated for:
- Proper JSON format
- Required fields (detailed response + summary)
- Reasonable length limits
- Absence of malicious code/scripts

## Architecture

### Files Added/Modified

#### New Files:
1. **`src/app/actions/recipeCookingAssistant.ts`**
   - Server action for AI cooking assistance
   - Input sanitization functions
   - Validation logic
   - OpenAI integration

2. **`migrations/add_cooking_notes_to_recipes.sql`**
   - Database migration to add `cooking_notes` column
   - Array type for storing multiple notes

3. **`RECIPE_COOKING_ASSISTANT.md`** (this file)
   - Feature documentation

#### Modified Files:
1. **`src/components/RecipeModal.tsx`**
   - Added cooking assistant UI
   - Chat interface with messages
   - Question input and submission
   - Cooking notes display section

2. **`src/types/database.ts`**
   - Added `cooking_notes?: string[]` to Recipe interface
   - Added to RecipeInsert interface

3. **`src/app/meal-plan/[id]/actions.ts`**
   - Added `saveCookingNote()` server action
   - Handles appending notes to recipes

4. **`src/app/meal-plan/[id]/MealPlanView.tsx`**
   - Added `handleSaveCookingNote()` handler
   - Passed handler to RecipeModal component

## Usage Flow

1. User opens a recipe in the meal plan view
2. Recipe modal displays with new "Cooking Assistant" section
3. User types a cooking question in the input field
4. System sanitizes input and validates it's cooking-related
5. AI processes question with recipe context
6. AI returns:
   - Detailed response (shown in chat)
   - Short summary (saved as cooking note)
7. System checks if response is recipe-related
8. Note is automatically saved ONLY if question was valid
   - Rejection messages are NOT saved as notes
   - Only cooking-related tips are persisted
9. Notes section displays all saved tips
10. User can continue asking questions

## Database Schema

### Recipes Table
```sql
ALTER TABLE recipes 
ADD COLUMN cooking_notes TEXT[];
```

The `cooking_notes` column:
- Stores an array of strings
- Each entry is a short cooking tip/note
- Generated from AI assistant interactions
- Persists across sessions

## Security Measures

### 1. Input Sanitization
```typescript
function sanitizeUserInput(input: string): string {
  // Removes HTML tags
  // Strips script tags
  // Blocks SQL injection patterns
  // Removes code blocks
  // Limits length to 500 chars
}
```

### 2. Question Validation
```typescript
function isValidCookingQuestion(question: string): boolean {
  // Checks minimum length
  // Requires cooking-related keywords
  // Validates question structure
}
```

### 3. AI System Prompt
The system prompt enforces:
- Recipe-specific answers only
- No off-topic responses
- Structured JSON output
- Concise, practical advice

### 4. Response Validation
- JSON parsing validation
- Field presence checks
- Length restrictions
- Script/code detection in responses

### 5. Smart Note Filtering
- Rejection messages are not saved as notes
- Only valid cooking-related responses are persisted
- Checks response content for rejection patterns
- Prevents note clutter from invalid questions

## Error Handling

The system gracefully handles:
- Invalid/empty questions
- Non-cooking questions
- AI API failures
- Database errors
- Network issues

Error messages are user-friendly and actionable.

## Future Enhancements

Potential improvements:
1. Voice input for hands-free cooking
2. Step-by-step guided mode
3. Timer integration with voice alerts
4. Photo upload for visual troubleshooting
5. Recipe difficulty adjustment suggestions
6. Ingredient substitution recommendations
7. Cooking video suggestions
8. Multi-language support

## Testing Recommendations

### Test Cases:
1. Valid cooking questions → Success
2. Non-cooking questions → Rejection with helpful message
3. HTML/script injection attempts → Sanitized
4. Very long questions → Truncated
5. Empty questions → Validation error
6. Multiple questions in session → All saved
7. Recipe without notes → Empty state handled
8. Recipe with many notes → All displayed

### Edge Cases:
- No internet connection
- OpenAI API down
- Database connection failure
- Malformed AI responses
- Concurrent note saves

## Dependencies

- OpenAI API (gpt-4o-mini model)
- Supabase (PostgreSQL with array support)
- Next.js server actions
- React hooks (useState, useEffect)

## Performance Considerations

- AI calls are async with loading states
- Notes are cached in React state
- Database updates use optimistic UI patterns
- Chat history resets on modal close
- Responses are streamed for better UX

## Maintenance Notes

- Monitor OpenAI API usage/costs
- Review AI responses for quality
- Update sanitization rules as needed
- Adjust validation keywords based on usage
- Consider rate limiting per user
- Monitor database array size growth

## Support

For issues or questions:
1. Check error logs in browser console
2. Verify OpenAI API key is configured
3. Ensure database migration ran successfully
4. Test with simple cooking questions first
5. Check network connectivity


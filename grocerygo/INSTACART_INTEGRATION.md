# Instacart Integration

## Overview

GroceryGo integrates with Instacart Connect API to allow users to order their meal plan groceries directly from the app. This integration converts the shopping list into an Instacart-compatible format and opens a pre-filled shopping cart on Instacart's platform.

## Files

### Types: `/src/types/instacart.ts`

Defines the TypeScript interfaces for the Instacart API:

```typescript
export interface LineItemMeasurement {
  quantity: number;
  unit: string;
}

export interface LineItem {
  name: string;
  quantity: number;
  unit: string;
  display_text: string;
  line_item_measurements: LineItemMeasurement[];
  filters: {
    brand_filters: string[];
    health_filters: string[];
  };
}

export interface LandingPageConfiguration {
  partner_linkback_url: string;
  enable_pantry_items: boolean;
}

export interface ShoppingListData {
  title: string;
  image_url: string;
  link_type: string;
  expires_in: number;
  instructions: string[];
  line_items: LineItem[];
  landing_page_configuration: LandingPageConfiguration;
}

export interface InstacartResponse {
  link: string;
  expires_at: string;
}
```

### Server Action: `/src/app/meal-plan/[id]/actions.ts`

Server-side action that handles the API call to Instacart:

#### Function: `createInstacartOrder`

**Parameters:**
- `mealPlanId: string` - ID of the meal plan (used for caching)
- `groceryItems: GroceryItem[]` - Array of grocery items from the meal plan
- `mealPlanTitle: string` - Title for the shopping list (displayed in Instacart)
- `mealPlanUrl: string` - URL to link back to the meal plan

**Returns:**
```typescript
Promise<{ success: boolean; link?: string; error?: string }>
```

**Process:**
1. Validates that INSTACART_API_KEY is configured
2. **Checks database for cached Instacart link:**
   - If a valid cached link exists (not expired), returns it immediately
   - Uses 1-hour buffer before expiration for safety
3. If no valid cache, generates new link:
   - Converts GroceryItem objects to Instacart LineItem format
   - Creates a ShoppingListData payload with:
     - Title and instructions
     - Line items with quantities and units
     - Partner linkback URL
     - 24-hour expiration
   - Makes POST request to Instacart API
4. **Caches the new link in database:**
   - Stores link URL in `meal_plans.instacart_link`
   - Stores expiration time in `meal_plans.instacart_link_expires_at`
5. Returns success with link or error message

**Environment Variables Required:**
- `INSTACART_API_KEY` - API key from Instacart Connect

### UI Component: `/src/app/meal-plan/[id]/MealPlanView.tsx`

#### State Management

```typescript
const [isOrderingInstacart, setIsOrderingInstacart] = useState(false)
const [instacartError, setInstacartError] = useState<string | null>(null)
```

#### Handler Function: `handleOrderInstacart`

1. Validates that grocery items exist
2. Sets loading state
3. Constructs meal plan URL and title
4. Calls `createInstacartOrder` server action
5. Opens returned Instacart link in new tab
6. Handles errors and displays to user

#### UI Elements

**Location:** Shopping List tab sidebar, between "Shopping Summary" and "Shopping Tip"

**Button States:**
- **Default:** "Order from Instacart" with shopping cart icon
- **Loading:** "Creating Order..." with spinner animation
- **Disabled:** When no grocery items or already loading

**Error Display:**
- Shows error message in red alert box below button
- Auto-clears when retry is attempted

## API Endpoint

**URL:** `https://connect.dev.instacart.tools/idp/v1/products/products_link`

**Method:** POST

**Headers:**
```typescript
{
  'Authorization': `Bearer ${INSTACART_API_KEY}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}
```

**Request Body:** ShoppingListData object

**Response:**
```typescript
{
  link: string,        // URL to Instacart shopping cart
  expires_at: string   // ISO timestamp when link expires
}
```

## Data Transformation

### From GroceryItem to LineItem

```typescript
GroceryItem {
  item_name: "Chicken Breast"
  quantity: 2
  unit: "lbs"
}

// Transforms to:

LineItem {
  name: "Chicken Breast"
  quantity: 2
  unit: "lbs"
  display_text: "2 lbs Chicken Breast"
  line_item_measurements: [{ quantity: 2, unit: "lbs" }]
  filters: { brand_filters: [], health_filters: [] }
}
```

### Default Values

- If `quantity` is missing: defaults to 1
- If `unit` is missing: defaults to "count"
- Empty arrays for brand and health filters
- Pantry items enabled by default

## User Flow

1. User navigates to meal plan page
2. Switches to "Shopping List" tab
3. Reviews grocery items
4. Clicks "Order from Instacart" button
5. System creates shopping list via API
6. New browser tab opens with Instacart
7. User completes checkout on Instacart
8. Can return to meal plan via linkback URL

## Error Handling

### Client-Side Errors

1. **No items to order** - Validation before API call
2. **Network errors** - Caught and displayed to user
3. **Unexpected errors** - Generic message with console logging

### Server-Side Errors

1. **Missing API key** - Returns error before API call
2. **API request failure** - Logs details and returns error
3. **Invalid response** - Caught and returned as error

All errors are displayed in the UI with a red alert box below the button.

## Configuration

### Environment Setup

Add to `.env.local`:
```bash
INSTACART_API_KEY=your_instacart_api_key_here
```

### Getting an API Key

1. Visit [Instacart Connect](https://connect.instacart.com/)
2. Sign up for a developer account
3. Create an application
4. Copy the API key to your environment variables

### Link Expiration

Shopping links expire after 24 hours (86400 seconds). This is configured in the `expires_in` field of the request.

## Link Caching

To improve performance and reduce unnecessary API calls, Instacart links are cached per meal plan:

### Database Schema

```sql
ALTER TABLE meal_plans
ADD COLUMN instacart_link TEXT,
ADD COLUMN instacart_link_expires_at TIMESTAMP WITH TIME ZONE;
```

### Caching Behavior

1. **First Request:** When a user clicks "Order from Instacart" for the first time:
   - API call is made to Instacart
   - Link is saved to `meal_plans.instacart_link`
   - Expiration is saved to `meal_plans.instacart_link_expires_at`
   - Link opens in new tab

2. **Subsequent Requests:** When the same meal plan's link is requested again:
   - Checks if cached link exists and hasn't expired (with 1-hour buffer)
   - If valid, returns cached link immediately (no API call)
   - If expired, generates new link and updates cache

3. **Expiration Handling:**
   - Links expire 24 hours after creation (Instacart default)
   - System checks expiration with 1-hour safety buffer
   - Expired links are automatically regenerated

### Benefits

- **Performance:** Instant link retrieval for repeat requests
- **API Efficiency:** Reduces unnecessary calls to Instacart API
- **User Experience:** Faster response times after first generation
- **Cost Savings:** Minimizes API usage charges (if applicable)

## Future Enhancements

1. **Dietary Filters** - Map dietary restrictions to health_filters
2. **Brand Preferences** - Allow users to specify preferred brands
3. **Store Selection** - Let users choose their preferred Instacart store
4. **Order History** - Track which meal plans were ordered
5. **Bulk Actions** - Allow ordering multiple meal plans at once
6. **Price Comparison** - Show estimated Instacart prices vs meal plan estimates
7. **Recurring Orders** - Auto-create orders for recurring meal plans
8. **Cache Invalidation** - Clear cache when grocery list is modified

## Testing

### Manual Testing

1. Create a meal plan with grocery items
2. Navigate to shopping list tab
3. Click "Order from Instacart"
4. Verify:
   - Loading state appears
   - New tab opens with Instacart
   - Shopping cart contains all items
   - Quantities and units are correct
   - Can return to meal plan via link

### Error Testing

1. **No API Key:** Remove INSTACART_API_KEY and verify error message
2. **Empty List:** Try ordering with 0 items
3. **Invalid API Key:** Use wrong key and verify error handling
4. **Network Error:** Disconnect internet and test

## Security Considerations

1. **API Key Protection** - Never expose in client code
2. **Server Actions** - All API calls are server-side
3. **URL Validation** - Ensure linkback URLs are properly formed
4. **Data Sanitization** - Item names are used as-is (consider sanitization)
5. **Rate Limiting** - Consider implementing if users spam button

## Dependencies

- Next.js Server Actions
- Native fetch API
- No additional npm packages required

## Limitations

1. **Development API** - Currently uses dev endpoint
2. **No Product Matching** - Instacart does the product matching
3. **No Price Updates** - Estimated prices not updated with actual Instacart prices
4. **No Order Tracking** - No way to know if user completed checkout
5. **Single Store** - No multi-store support
6. **No Substitutions** - Can't specify substitution preferences

## Troubleshooting

### Link doesn't open
- Check if popup blocker is enabled
- Verify API key is correct
- Check network tab for API errors

### Wrong items in cart
- Verify GroceryItem data in database
- Check data transformation logic
- Review Instacart API request payload

### API errors
- Check API key is set in environment
- Verify API endpoint URL is correct
- Check Instacart API status
- Review server logs for details


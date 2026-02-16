import { describe, it, expect } from 'vitest'
import type { GroceryItem } from '@/types/database'
import type { LineItem } from '@/types/instacart'

function toLineItem(groceryItem: GroceryItem): LineItem {
  const quantity = groceryItem.quantity ?? 1
  const unit = groceryItem.unit ?? 'each'
  return {
    name: groceryItem.item_name,
    quantity,
    unit,
    display_text: `${quantity} ${unit} ${groceryItem.item_name}`,
    line_item_measurements: [{ quantity, unit }],
    filters: { brand_filters: [], health_filters: [] },
  }
}

describe('Instacart flow compatibility', () => {
  it('grocery items with category field convert to valid Instacart line items', () => {
    const groceryItem: GroceryItem = {
      id: 'gi-1',
      meal_plan_id: 'mp-1',
      item_name: 'Salmon fillet',
      quantity: 1,
      unit: 'lb',
      category: 'Seafood',
      estimated_price: 12.99,
      purchased: false,
    }

    const lineItem = toLineItem(groceryItem)

    expect(lineItem.name).toBe('Salmon fillet')
    expect(lineItem.quantity).toBe(1)
    expect(lineItem.unit).toBe('lb')
  })

  it('grocery items without category still work', () => {
    const groceryItem: GroceryItem = {
      id: 'gi-2',
      meal_plan_id: 'mp-1',
      item_name: 'Rice',
      quantity: 2,
      unit: 'cups',
      purchased: false,
    }

    const lineItem = toLineItem(groceryItem)

    expect(lineItem.name).toBe('Rice')
  })
})

/**
 * Client-side utility functions for calculating meal plan status
 */

/**
 * Check if the current date falls within the meal plan's date range
 * A meal plan covers 7 days starting from week_of
 * @param weekOf - The start date of the meal plan (YYYY-MM-DD)
 * @returns true if current date is within the meal plan's date range
 */
export function isCurrentDateInMealPlanRange(weekOf: string): boolean {
  // Parse the date string to avoid timezone issues
  const [year, month, day] = weekOf.split('-').map(Number)
  const startDate = new Date(year, month - 1, day)
  
  // Calculate end date (6 days after start, so 7 days total)
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)
  
  // Get current date (local timezone, set to midnight for date-only comparison)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Set start and end dates to midnight for date-only comparison
  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(0, 0, 0, 0)
  
  // Check if today is within the range (inclusive)
  return today >= startDate && today <= endDate
}

/**
 * Calculate the effective status of a meal plan based on current date
 * If the current date is in the meal plan's range and status is 'pending', 
 * return 'in-progress', otherwise return the original status
 * @param weekOf - The start date of the meal plan (YYYY-MM-DD)
 * @param currentStatus - The current status from the database
 * @returns The effective status to display
 */
export function getEffectiveMealPlanStatus(
  weekOf: string,
  currentStatus: 'completed' | 'in-progress' | 'pending' | 'generating'
): 'completed' | 'in-progress' | 'pending' | 'generating' {
  // Don't override 'completed' or 'generating' statuses
  if (currentStatus === 'completed' || currentStatus === 'generating') {
    return currentStatus
  }
  
  // If current date is in range and status is 'pending', show as 'in-progress'
  if (currentStatus === 'pending' && isCurrentDateInMealPlanRange(weekOf)) {
    return 'in-progress'
  }
  
  return currentStatus
}


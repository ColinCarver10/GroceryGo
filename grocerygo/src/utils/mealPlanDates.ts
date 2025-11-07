/**
 * Utility functions for calculating meal plan dates
 * Uses local date arithmetic to avoid timezone-related date shifting
 */

type DayOfWeek = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'

/**
 * Get the next occurrence of a specific day of the week
 * Returns the date in YYYY-MM-DD format
 * 
 * @param startDayOfWeek - The day that should be considered the start of the week (default: 'Monday')
 * @returns ISO date string (YYYY-MM-DD) for the start of the next week
 */
export function getNextWeekStart(startDayOfWeek: DayOfWeek = 'Monday'): string {
  const daysMap: Record<DayOfWeek, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6
  }
  
  const targetDay = daysMap[startDayOfWeek]
  const today = new Date()
  const currentDay = today.getDay()
  
  // Calculate days until next occurrence of target day
  let daysUntilTarget = targetDay - currentDay
  
  // If target day is today or earlier in the week, get next week's occurrence
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7
  }
  
  // Create date in local timezone
  const nextWeekStart = new Date(today)
  nextWeekStart.setDate(today.getDate() + daysUntilTarget)
  
  // Format as YYYY-MM-DD using local timezone
  const year = nextWeekStart.getFullYear()
  const month = String(nextWeekStart.getMonth() + 1).padStart(2, '0')
  const day = String(nextWeekStart.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Get the date for a meal based on its index in the meal plan
 * Falls back to cycling through days of the week
 */
export function getDateForMealIndex(weekOf: string, index: number): string {
  // Parse the date string to avoid timezone issues
  const [year, month, day] = weekOf.split('-').map(Number)
  const startDate = new Date(year, month - 1, day)
  
  const dayOffset = index % 7
  const mealDate = new Date(startDate)
  mealDate.setDate(startDate.getDate() + dayOffset)
  
  // Format as YYYY-MM-DD using local timezone
  const resultYear = mealDate.getFullYear()
  const resultMonth = String(mealDate.getMonth() + 1).padStart(2, '0')
  const resultDay = String(mealDate.getDate()).padStart(2, '0')
  
  return `${resultYear}-${resultMonth}-${resultDay}`
}

/**
 * Get the date for a scheduled meal based on the day name
 * Assumes weekOf is Monday (start of week in this app)
 */
export function getDateForScheduledMeal(weekOf: string, dayName: string): string {
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  
  // Parse the date string to avoid timezone issues
  const [year, month, day] = weekOf.split('-').map(Number)
  const startDate = new Date(year, month - 1, day)
  
  const dayIndex = daysOfWeek.indexOf(dayName)
  
  // If day not found, fall back to startDate
  if (dayIndex === -1) {
    const resultYear = startDate.getFullYear()
    const resultMonth = String(startDate.getMonth() + 1).padStart(2, '0')
    const resultDay = String(startDate.getDate()).padStart(2, '0')
    return `${resultYear}-${resultMonth}-${resultDay}`
  }
  
  const mealDate = new Date(startDate)
  mealDate.setDate(startDate.getDate() + dayIndex)
  
  // Format as YYYY-MM-DD using local timezone
  const resultYear = mealDate.getFullYear()
  const resultMonth = String(mealDate.getMonth() + 1).padStart(2, '0')
  const resultDay = String(mealDate.getDate()).padStart(2, '0')
  
  return `${resultYear}-${resultMonth}-${resultDay}`
}


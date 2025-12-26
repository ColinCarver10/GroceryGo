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
 * Works with any start day of the week (not just Monday)
 */
export function getDateForScheduledMeal(weekOf: string, dayName: string): string {
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6
  }
  
  // Parse the date string to avoid timezone issues
  const [year, month, day] = weekOf.split('-').map(Number)
  const startDate = new Date(year, month - 1, day)
  
  // Get the day of week for the start date (0 = Sunday, 1 = Monday, etc.)
  const startDayOfWeek = startDate.getDay()
  const targetDayOfWeek = dayMap[dayName]
  
  // If day not found, fall back to startDate
  if (targetDayOfWeek === undefined) {
    const resultYear = startDate.getFullYear()
    const resultMonth = String(startDate.getMonth() + 1).padStart(2, '0')
    const resultDay = String(startDate.getDate()).padStart(2, '0')
    return `${resultYear}-${resultMonth}-${resultDay}`
  }
  
  // Calculate the offset from the start date
  let dayOffset = targetDayOfWeek - startDayOfWeek
  
  // If the target day is earlier in the week than the start day, add 7 days
  // This handles cases where the week starts on, say, Wednesday and we want Monday
  if (dayOffset < 0) {
    dayOffset += 7
  }
  
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
 * Works with any start day of the week (not just Monday)
 * Returns undefined if dayName is not provided or invalid
 */
export function getDateForDayName(weekOf: string, dayName?: string): string | undefined {
  if (!dayName) return undefined

  const normalizedDay = dayName.trim().toLowerCase()
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  }

  const targetOffset = dayMap[normalizedDay]

  if (targetOffset === undefined) {
    return undefined
  }

  // Parse the date string to avoid timezone issues
  const [year, month, day] = weekOf.split('-').map(Number)
  const startDate = new Date(year, month - 1, day)
  
  if (Number.isNaN(startDate.getTime())) {
    return undefined
  }

  const startDayIndex = startDate.getDay()

  // Calculate the offset from the start date
  let offset = targetOffset - startDayIndex

  // If the target day is earlier in the week than the start day, add 7 days
  // This handles cases where the week starts on, say, Saturday and we want Sunday
  if (offset < 0) {
    offset += 7
  }

  const mealDate = new Date(startDate)
  mealDate.setDate(startDate.getDate() + offset)

  // Format as YYYY-MM-DD using local timezone
  const resultYear = mealDate.getFullYear()
  const resultMonth = String(mealDate.getMonth() + 1).padStart(2, '0')
  const resultDay = String(mealDate.getDate()).padStart(2, '0')
  
  return `${resultYear}-${resultMonth}-${resultDay}`
}

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
 * Check if two meal plan date ranges overlap
 * Each meal plan covers 7 days starting from week_of
 * @param weekOf1 - The start date of the first meal plan (YYYY-MM-DD)
 * @param weekOf2 - The start date of the second meal plan (YYYY-MM-DD)
 * @returns true if the date ranges overlap
 */
export function doMealPlanRangesOverlap(weekOf1: string, weekOf2: string): boolean {
  // Parse both date strings
  const [year1, month1, day1] = weekOf1.split('-').map(Number)
  const [year2, month2, day2] = weekOf2.split('-').map(Number)
  
  const startDate1 = new Date(year1, month1 - 1, day1)
  const startDate2 = new Date(year2, month2 - 1, day2)
  
  // Calculate end dates (6 days after start, so 7 days total)
  const endDate1 = new Date(startDate1)
  endDate1.setDate(startDate1.getDate() + 6)
  
  const endDate2 = new Date(startDate2)
  endDate2.setDate(startDate2.getDate() + 6)
  
  // Set all dates to midnight for date-only comparison
  startDate1.setHours(0, 0, 0, 0)
  endDate1.setHours(0, 0, 0, 0)
  startDate2.setHours(0, 0, 0, 0)
  endDate2.setHours(0, 0, 0, 0)
  
  // Two ranges overlap if: start1 <= end2 AND start2 <= end1
  return startDate1 <= endDate2 && startDate2 <= endDate1
}


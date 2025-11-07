/**
 * Shared configuration for user preference questions
 * Used in both onboarding flow and dashboard preferences
 */

export type QuestionType = 'multiple-choice' | 'multiple-select' | 'ranking' | 'removable-list'

export interface Question {
  id: string
  type: QuestionType
  label: string
  question: string
  description?: string
  options: string[]
  maxSelections?: number
}

export interface QuestionSection {
  title: string
  questions: Question[]
}

// All questions definitions
export const questions: Record<string, Question> = {
  '1': {
    id: '1',
    type: 'multiple-choice',
    label: 'Age Range',
    question: 'What is your age range?',
    options: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'],
  },
  '2': {
    id: '2',
    type: 'multiple-choice',
    label: 'Household Size',
    question: 'How many people are you cooking for?',
    options: ['Just me', '2 people', '3-4 people', '5+ people'],
  },
  '3': {
    id: '3',
    type: 'multiple-choice',
    label: 'Weekly Budget',
    question: 'What is your weekly meal planning budget?',
    options: ['$50-100', '$101-200', '$201-300', '$301+'],
  },
  '4': {
    id: '4',
    type: 'multiple-choice',
    label: 'Cooking Skill Level',
    question: 'What is your cooking skill level?',
    options: [
      'Beginner (Basic cooking skills)',
      'Intermediate (Comfortable with most recipes)',
      'Advanced (Confident with complex techniques)'
    ],
  },
  '5': {
    id: '5',
    type: 'multiple-choice',
    label: 'Prep Time Available',
    question: 'What is your average time available for meal preparation?',
    options: [
      'Quick (15-30 minutes)',
      'Standard (30-45 minutes)',
      'Extended (45+ minutes)'
    ],
  },
  '6': {
    id: '6',
    type: 'multiple-select',
    label: 'Dietary Restrictions',
    question: 'Dietary restrictions: (Select all that apply)',
    options: [
      'No restrictions',
      'Vegetarian',
      'Vegan',
      'Gluten-free',
      'Dairy-free',
      'Keto/Low-carb',
      'Paleo',
      'Other'
    ],
  },
  '7': {
    id: '7',
    type: 'multiple-select',
    label: 'Allergies/Intolerances',
    question: 'Food allergies or intolerances: (Select all that apply)',
    options: [
      'None',
      'Nuts',
      'Shellfish',
      'Eggs',
      'Soy',
      'Wheat',
      'Other'
    ],
  },
  '8': {
    id: '8',
    type: 'multiple-select',
    label: 'Flavor Preferences',
    question: 'Flavor preferences: (Select up to 3)',
    options: [
      'Spicy',
      'Sweet',
      'Savory',
      'Tangy/Acidic',
      'Mild',
      'Umami/Rich'
    ],
    maxSelections: 3,
  },
  '9': {
    id: '9',
    type: 'multiple-select',
    label: 'Meal Planning Goals',
    question: 'What are your main goals with meal planning?',
    options: [
      'Save time on meal planning',
      'Eat healthier',
      'Learn new recipes',
      'Save money on groceries',
      'Reduce food waste',
      'Other',
    ],
  },
  '10': {
    id: '10',
    type: 'multiple-select',
    label: 'Preferred Delivery Days',
    question: 'Preferred grocery delivery days: (Select up to 2)',
    options: [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ],
    maxSelections: 2,
  },
  '11': {
    id: '11',
    type: 'ranking',
    label: 'Priority Rankings',
    question: "What's most important to you in meal planning? (Rank your top 3)",
    description: "Use the up/down buttons to arrange by importance. Your #1 choice is most important.",
    options: [
      'Cost efficiency',
      'Time saving',
      'Nutrition'
    ],
  },
  'favored_ingredients': {
    id: 'favored_ingredients',
    type: 'removable-list',
    label: 'Favored Ingredients',
    question: 'Favored Ingredients',
    options: [], // Dynamic - comes from user's saved data
  },
  'excluded_ingredients': {
    id: 'excluded_ingredients',
    type: 'removable-list',
    label: 'Excluded Ingredients',
    question: 'Excluded Ingredients',
    options: [], // Dynamic - comes from user's saved data
  },
}

// Sections for onboarding flow
export const onboardingSections: QuestionSection[] = [
  {
    title: "Personal Information",
    questions: [
      questions['1'],
      questions['2'],
    ],
  },
  {
    title: "Meal Planning Preferences",
    questions: [
      questions['3'],
      questions['4'],
      questions['5'],
    ],
  },
  {
    title: "Dietary Preferences",
    questions: [
      questions['6'],
      questions['7'],
      questions['8'],
    ],
  },
  {
    title: "Scheduling",
    questions: [
      questions['9'],
      questions['10'],
    ],
  },
  {
    title: "Priorities",
    questions: [
      questions['11'],
    ],
  },
]

// Question labels map (for backward compatibility and quick lookups)
export const questionLabels: Record<string, string> = Object.fromEntries(
  Object.entries(questions).map(([id, q]) => [id, q.label])
)


/**
 * Shared configuration for user preference questions
 * Used in both onboarding flow and dashboard preferences
 */

export type QuestionType = 'multiple-choice' | 'multiple-select' | 'ranking' | 'removable-list' | 'autocomplete-ingredients'

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
  '12': {
    id: '12',
    type: 'autocomplete-ingredients',
    label: 'Foods You Like',
    question: 'Select foods you enjoy (Type or select from list)',
    description: 'Start typing to search for ingredients, or select from the dropdown',
    options: [], // Options come from server-side ingredient list
  },
  '13': {
    id: '13',
    type: 'autocomplete-ingredients',
    label: 'Foods You Dislike',
    question: 'Select foods you dislike or want to avoid (Type or select from list)',
    description: 'Start typing to search for ingredients, or select from the dropdown',
    options: [], // Options come from server-side ingredient list
  },
  'favored_ingredients': {
    id: 'favored_ingredients',
    type: 'autocomplete-ingredients',
    label: 'Favored Ingredients',
    question: 'Favored Ingredients',
    options: [], // Options come from server-side ingredient list
  },
  'excluded_ingredients': {
    id: 'excluded_ingredients',
    type: 'autocomplete-ingredients',
    label: 'Excluded Ingredients',
    question: 'Excluded Ingredients',
    options: [], // Options come from server-side ingredient list
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
      questions['12'],
      questions['13'],
    ],
  },
  {
    title: "Scheduling",
    questions: [
      questions['9'],
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


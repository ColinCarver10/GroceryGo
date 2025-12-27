export interface WalkthroughStep {
  title: string
  description: string
  icon?: string
  tips?: string[]
}

export const walkthroughSteps: WalkthroughStep[] = [
  {
    title: 'Welcome to GroceryGo!',
    description: 'We\'re excited to help you eat healthier, save time, and stay on budget. This quick tour will show you everything you need to know to get started.',
    icon: '👋',
    tips: [
      'AI-powered meal planning tailored to your preferences',
      'Automatic grocery list generation',
      'Budget-friendly recipe suggestions'
    ]
  },
  {
    title: 'Your Dashboard',
    description: 'This is your command center! Here you can see all your meal plans, access your saved recipes, and manage your preferences. The dashboard shows your meal plans organized by week, with status indicators for each plan.',
    icon: '📊',
    tips: [
      'View all your meal plans in one place',
      'See quick stats about your meal planning history',
      'Access your saved recipes and preferences'
    ]
  },
  {
    title: 'Generating Meal Plans',
    description: 'Click "Generate New Meal Plan" to create a personalized weekly meal plan. Select which meals you want (breakfast, lunch, dinner) for each day, and our AI will create recipes that match your dietary preferences, budget, and skill level.',
    icon: '🍽️',
    tips: [
      'Select meals by clicking on the day and meal type',
      'Use quick action buttons to select multiple meals at once',
      'The AI considers your preferences from the onboarding survey'
    ]
  },
  {
    title: 'Viewing Meal Plans',
    description: 'Click on any meal plan to see the full details. You\'ll see all recipes organized by day, complete ingredient lists, and a consolidated shopping list. You can adjust portion sizes, swap ingredients, and mark items as you shop.',
    icon: '📅',
    tips: [
      'View recipes by clicking on meal slots',
      'Check off ingredients as you shop under the shopping list',
      'Automatically order Instacart groceries from the shopping list'
    ]
  },
  {
    title: 'Saved Recipes',
    description: 'Found a recipe you love? Click the heart icon to save it to your favorites! Saved recipes appear in your dashboard and can be easily accessed anytime. Perfect for building your personal recipe collection.',
    icon: '❤️',
    tips: [
      'Save recipes from any meal plan',
      'Access your saved recipes from the dashboard',
      'Build your personal recipe collection over time'
    ]
  },
  {
    title: 'Managing Preferences',
    description: 'Your dietary preferences are stored in the "My Preferences" section. You can update them anytime - change your budget, dietary restrictions, favorite ingredients, or cooking skill level. These preferences guide all meal plan generation.',
    icon: '⚙️',
    tips: [
      'Update preferences anytime from the dashboard',
      'Changes affect future meal plan generations',
      'Your preferences help the AI create better meal plans'
    ]
  },
  {
    title: 'Shopping Lists',
    description: 'Every meal plan includes a complete shopping list with all ingredients you\'ll need. The list is automatically organized and consolidated - if multiple recipes use the same ingredient, it\'s combined into one item with the total quantity needed.',
    icon: '🛒',
    tips: [
      'Shopping lists are automatically generated',
      'Ingredients are consolidated across all recipes',
      'Check off items as you shop'
    ]
  },
  {
    title: 'Recipe Cooking Assistant',
    description: 'While viewing a recipe, you can ask our AI cooking assistant questions about the recipe. Get help with substitutions, cooking techniques, or any recipe-related questions. The assistant provides detailed, helpful answers to make cooking easier.',
    icon: '🤖',
    tips: [
      'Ask questions about any recipe',
      'Get help with ingredient substitutions',
      'Learn cooking techniques and tips'
    ]
  },
  {
    title: 'You\'re All Set!',
    description: 'You now know everything you need to get started with GroceryGo! Start by generating your first meal plan, and remember - you can always update your preferences or explore saved recipes. Happy cooking!',
    icon: '🎉',
    tips: [
      'Generate your first meal plan to get started',
      'Don\'t forget to save recipes you love',
      'Update your preferences as your needs change'
    ]
  },
  {
    title: 'Beta Testing Notice',
    description: 'GroceryGo is currently in Beta testing. While we\'re working hard to make it perfect, you may encounter occasional bugs or issues. Your feedback is incredibly valuable to us and helps improve the app for everyone. By continuing, you acknowledge that you understand the risks associated with using beta software.',
    icon: '⚠️',
    tips: [
      'Report any bugs or issues you encounter',
      'Share your feedback and suggestions',
      'Features may change as we continue development'
    ]
  }
]


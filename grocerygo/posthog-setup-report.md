# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into your GroceryGo Next.js application. This integration includes client-side tracking via the `instrumentation-client.ts` file (the recommended approach for Next.js 15.3+), server-side tracking using `posthog-node` for secure event capture in server actions, and a reverse proxy configuration to ensure analytics work reliably even with ad blockers.

## Summary of Changes

### Core Infrastructure
- **`instrumentation-client.ts`** - Client-side PostHog initialization with exception capture and debug mode
- **`src/lib/posthog-server.ts`** - Server-side PostHog client singleton for use in server actions
- **`next.config.ts`** - Added reverse proxy rewrites for `/ingest/*` to PostHog servers
- **`.env`** - Added `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` environment variables

### Events Instrumented

| Event Name | Description | File Path |
|------------|-------------|-----------|
| `user_signed_up` | User successfully creates a new account | `src/app/login/actions.tsx` |
| `user_logged_in` | User successfully logs in with email/password | `src/app/login/actions.tsx` |
| `user_logged_in_google` | User initiates Google OAuth sign-in | `src/app/login/actions.tsx` |
| `user_logged_out` | User logs out of their account | `src/app/actions/auth.ts` |
| `login_error` | Login attempt failed - tracked for debugging | `src/app/login/actions.tsx` |
| `onboarding_completed` | User completes the onboarding survey/questionnaire | `src/app/onboarding/actions.tsx` |
| `meal_plan_generation_started` | User initiates meal plan generation (conversion funnel top) | `src/app/meal-plan-generate/MealPlanGenerateClient.tsx` |
| `meal_plan_created` | Meal plan successfully created (server-side confirmation) | `src/app/meal-plan-generate/actions.ts` |
| `instacart_order_created` | User creates an Instacart order from shopping list | `src/app/meal-plan/[id]/actions.ts` |
| `recipe_replaced` | User replaces a recipe in their meal plan | `src/app/meal-plan/[id]/actions.ts` |
| `shopping_list_item_checked` | User checks off an item from the shopping list | `src/app/meal-plan/[id]/actions.ts` |
| `recipe_modal_opened` | User opens a recipe modal to view details | `src/components/RecipeModal.tsx` |
| `meal_plan_feedback_submitted` | User submits feedback on a meal plan | `src/components/MealPlanFeedback.tsx` |

### User Identification
Users are identified with PostHog upon:
- Successful login (email or Google OAuth)
- Account signup
- Onboarding completion (with additional properties like household size, cooking skill)

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

### Dashboard
- **[Analytics basics](https://us.posthog.com/project/303005/dashboard/1186614)** - Core analytics dashboard with all key metrics

### Insights
- **[User Signups & Logins](https://us.posthog.com/project/303005/insights/gWnB117r)** - Track daily authentication events
- **[Signup to Meal Plan Funnel](https://us.posthog.com/project/303005/insights/ChYhSKnr)** - Conversion funnel from signup to first meal plan
- **[Meal Plan Engagement](https://us.posthog.com/project/303005/insights/8lt5hGIy)** - Track engagement with Instacart orders, recipe changes, and feedback
- **[Login Errors & Churn Risk](https://us.posthog.com/project/303005/insights/zCxT0cHp)** - Monitor authentication issues that may indicate churn
- **[Shopping List & Recipe Interactions](https://us.posthog.com/project/303005/insights/u0vMtDtJ)** - Understand engagement depth with recipes and shopping lists

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/posthog-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog, including:

- Adding new custom events
- Setting up feature flags
- Implementing A/B testing
- Configuring session recordings
- Building new insights and dashboards

# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

GroceryGo is an AI-powered weekly meal planning Next.js 15 app located in `grocerygo/`. It is a single full-stack application (not a monorepo). All development commands should be run from `grocerygo/`.

### Running the application

```bash
cd grocerygo
npm run dev        # starts Next.js dev server with Turbopack on port 3000
```

A `.env.local` file is required in `grocerygo/` with at minimum:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The app can start with placeholder values for these, but Supabase-dependent features (auth, data) will not work. For full functionality, also set `OPENAI_API_KEY`.

### Middleware auth redirect

The Supabase middleware (`src/utils/supabase/middleware.ts`) redirects unauthenticated users to `/login` for all routes except `/`, `/login`, `/auth/*`, and `/error`. With placeholder Supabase credentials the auth check silently fails (user = null), so protected routes like `/onboarding` will redirect to `/login` unless you have valid Supabase credentials.

### Linting

```bash
cd grocerygo
npm run lint       # runs eslint
```

There are pre-existing lint errors in the codebase (~67 errors, ~35 warnings). These are not blockers for `npm run dev` or `npm run build` since `eslint.ignoreDuringBuilds` is set in `next.config.ts`.

### Building

```bash
cd grocerygo
npm run build      # builds with Turbopack; succeeds with placeholder env vars
```

### Testing

E2E tests use Playwright. To install browsers and run:

```bash
cd grocerygo
npx playwright install chromium
npm run test:e2e
```

Note: E2E tests require a running Supabase backend and likely valid credentials to pass.

### External dependencies

| Service | Required | Env vars |
|---------|----------|----------|
| Supabase (Postgres + Auth) | Yes | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| OpenAI API | Yes (for AI features) | `OPENAI_API_KEY` |
| Instacart Connect | No | `INSTACART_API_KEY`, `INSTACART_API_URL` |
| PostHog | No | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` |

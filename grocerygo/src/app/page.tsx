import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Hero Section */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-screen flex-col items-center justify-center py-12 text-center">
          
          {/* Logo/Brand */}
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-[#2DBE60] sm:text-6xl lg:text-7xl">
              GroceryGo
            </h1>
          </div>

          {/* Main Headline */}
          <div className="mb-6 max-w-3xl">
            <h2 className="text-3xl font-bold text-[#1F2937] sm:text-4xl lg:text-5xl">
              Let&apos;s make healthy eating easy this week!
            </h2>
          </div>

          {/* Subheadline */}
          <p className="mb-12 max-w-2xl text-lg text-[#6B7280] sm:text-xl">
            Get AI-powered weekly meal plans, a ready-to-go grocery cart, and Instacart delivery — all while staying under your budget.
          </p>

          {/* CTA Button */}
          <div className="mb-16">
            <Link
              href="/ai-chat"
              className="inline-block rounded-xl bg-[#2DBE60] px-8 py-4 text-lg font-semibold text-white shadow-md transition-all hover:bg-[#26a854] hover:shadow-lg"
            >
              Get Started
            </Link>
          </div>

          {/* Feature Cards */}
          <div className="mt-8 grid w-full max-w-5xl gap-6 sm:grid-cols-3">
            
            {/* Feature 1 */}
            <div className="rounded-xl bg-white p-6 shadow-md">
              <div className="mb-4 text-4xl">🍽️</div>
              <h3 className="mb-2 text-xl font-semibold text-[#1F2937]">
                Healthy Meal Plans
              </h3>
              <p className="text-[#6B7280]">
                AI creates personalized weekly meal plans perfect for beginner cooks.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-xl bg-white p-6 shadow-md">
              <div className="mb-4 text-4xl">🛒</div>
              <h3 className="mb-2 text-xl font-semibold text-[#1F2937]">
                Auto Grocery Cart
              </h3>
              <p className="text-[#6B7280]">
                We build your shopping list automatically and check out via Instacart.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-xl bg-white p-6 shadow-md">
              <div className="mb-4 text-4xl">💰</div>
              <h3 className="mb-2 text-xl font-semibold text-[#1F2937]">
                Budget Friendly
              </h3>
              <p className="text-[#6B7280]">
                Stay under your weekly budget with smart suggestions and savings.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

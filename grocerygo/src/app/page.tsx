import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  
  // Check if user is authenticated and has completed survey
  const { data: { user } } = await supabase.auth.getUser()
  
  let ctaHref = '/onboarding'
  
  if (user) {
    // Check if user has completed the questionnaire
    const { data: userData } = await supabase
      .from('users')
      .select('survey_response')
      .eq('user_id', user.id)
      .single()
    
    // If user has completed survey, send them to dashboard
    if (userData?.survey_response) {
      ctaHref = '/dashboard'
    }
  }
  
  return (
    <div className="gg-bg-page min-h-screen">
      {/* Hero Section */}
      <main className="gg-container">
        <div className="gg-hero">
          
          {/* Logo/Brand */}
          <div className="mb-8">
            <h1 className="gg-logo">
              GroceryGo
            </h1>
          </div>

          {/* Main Headline */}
          <div className="mb-6 max-w-3xl">
            <h2 className="gg-heading-hero">
              Let&apos;s make healthy eating easy this week!
            </h2>
          </div>

          {/* Subheadline */}
          <p className="gg-text-subtitle mb-12 max-w-2xl">
            Get AI-powered weekly meal plans, a ready-to-go grocery cart, and Instacart delivery — all while staying under your budget.
          </p>

          {/* CTA Button */}
          <div className="mb-16">
            <Link href={ctaHref} className="gg-btn-primary">
              Get Started
            </Link>
          </div>

          {/* Feature Cards */}
          <div className="mt-8 grid w-full max-w-5xl gap-6 sm:grid-cols-3">
            
            {/* Feature 1 */}
            <div className="gg-card-feature">
              <div className="gg-card-icon">🍽️</div>
              <h3 className="gg-heading-card mb-2">
                Healthy Meal Plans
              </h3>
              <p className="gg-text-body">
                AI creates personalized weekly meal plans perfect for beginner cooks.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="gg-card-feature">
              <div className="gg-card-icon">🛒</div>
              <h3 className="gg-heading-card mb-2">
                Auto Grocery Cart
              </h3>
              <p className="gg-text-body">
                We build your shopping list automatically and check out via Instacart.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="gg-card-feature">
              <div className="gg-card-icon">💰</div>
              <h3 className="gg-heading-card mb-2">
                Budget Friendly
              </h3>
              <p className="gg-text-body">
                Stay under your weekly budget with smart suggestions and savings.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

import { login, signup } from '@/app/login/actions'

export default function LoginPage() {
  return (
    <div className="gg-bg-page min-h-screen">
      <div className="gg-container">
        <div className="flex min-h-screen flex-col items-center justify-center py-12">
          
          {/* Welcome Message */}
          <div className="mb-8 text-center">
            <p className="gg-text-subtitle">Welcome back! Let&apos;s get cooking.</p>
          </div>

          {/* Login Form Card */}
          <div className="w-full max-w-md">
            <form className="gg-card">
              <h2 className="gg-heading-section mb-6">Sign In</h2>
              
              {/* Email Input */}
              <div className="gg-form-group">
                <label htmlFor="email" className="gg-label">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="gg-input"
                  placeholder="your@email.com"
                />
              </div>

              {/* Password Input */}
              <div className="gg-form-group mb-8">
                <label htmlFor="password" className="gg-label">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="gg-input"
                  placeholder="••••••••"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button formAction={login} className="gg-btn-primary w-full">
                  Log In
                </button>
                <button formAction={signup} className="gg-btn-outline w-full">
                  Sign Up
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
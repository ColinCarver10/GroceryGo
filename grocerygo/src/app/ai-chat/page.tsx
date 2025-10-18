'use client'

import { useState } from 'react'
import { processWithAI } from '@/app/ai-chat/actions'

export default function AIChatPage() {
  const [input, setInput] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResponse('')

    try {
      const result = await processWithAI(input)
      
      if (result.error) {
        setError(result.error)
      } else {
        setResponse(result.response || '')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            AI Meal Planner
          </h1>
          <p className="text-gray-600 mb-8">
            Enter your meal planning survey data (as JSON) and get a personalized meal plan with recipes and grocery list
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label 
                htmlFor="input" 
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Survey Data (JSON Format)
              </label>
              <textarea
                id="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='{"1": "25-34", "2": "5+ people", "3": "4-7 meals", "4": "$50-100", "5": "Intermediate (Comfortable with most recipes)", "6": "Quick (15-30 minutes)", "7": ["No restrictions"], "8": ["None"], "9": ["Savory", "Spicy"], "10": ["Eat healthier"], "11": ["Wednesday", "Sunday"], "12": ["Cost efficiency", "Nutrition", "Time saving"]}'
                rows={8}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none text-gray-900 placeholder-gray-400 font-mono text-sm"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg 
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                  >
                    <circle 
                      className="opacity-25" 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="4"
                    ></circle>
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </>
              ) : (
                'Generate Meal Plan'
              )}
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">
                <span className="font-semibold">Error: </span>
                {error}
              </p>
            </div>
          )}

          {response && (
            <div className="mt-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                Your Meal Plan:
              </h2>
              <div className="text-gray-700 whitespace-pre-wrap leading-relaxed font-mono text-sm overflow-x-auto">
                {response}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Powered by OpenAI • 
            <a href="/" className="ml-1 text-indigo-600 hover:text-indigo-700 underline">
              Back to Home
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}


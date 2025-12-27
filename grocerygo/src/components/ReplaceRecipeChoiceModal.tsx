'use client'

interface ReplaceRecipeChoiceModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerateNew: () => void
  onReplaceWithSaved: () => void
}

export default function ReplaceRecipeChoiceModal({
  isOpen,
  onClose,
  onGenerateNew,
  onReplaceWithSaved
}: ReplaceRecipeChoiceModalProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black opacity-40 z-50" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
        <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full pointer-events-auto">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Replace Recipe</h3>
            <p className="text-sm text-gray-600">
              How would you like to replace this recipe?
            </p>
          </div>
          
          <div className="space-y-3 mb-6">
            {/* Generate New Recipe Button */}
            <button
              onClick={() => {
                onGenerateNew()
                onClose()
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg border-2 border-gray-200 bg-white hover:border-[var(--gg-primary)] hover:bg-[var(--gg-primary)]/5 transition-all"
            >
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-[var(--gg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Generate New Recipe</div>
                <div className="text-sm text-gray-600">AI will create a new recipe based on your preferences</div>
              </div>
            </button>

            {/* Replace with Saved Recipe Button */}
            <button
              onClick={() => {
                onReplaceWithSaved()
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg border-2 border-gray-200 bg-white hover:border-[var(--gg-primary)] hover:bg-[var(--gg-primary)]/5 transition-all"
            >
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-[var(--gg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Use Saved Recipe</div>
                <div className="text-sm text-gray-600">Choose from your saved recipes</div>
              </div>
            </button>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  )
}


'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { getIngredientsList } from '@/app/actions/ingredients'

interface IngredientAutocompleteProps {
  value: string[]
  onChange: (ingredients: string[]) => void
  placeholder?: string
  maxSelections?: number
}

export default function IngredientAutocomplete({
  value,
  onChange,
  placeholder = 'Type to search ingredients...',
  maxSelections
}: IngredientAutocompleteProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [ingredients, setIngredients] = useState<string[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(true)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch ingredients on mount
  useEffect(() => {
    getIngredientsList()
      .then(setIngredients)
      .catch((error) => {
        console.error('Error fetching ingredients:', error)
      })
      .finally(() => setIsLoading(false))
  }, [])

  // Filter ingredients based on search query
  const filteredOptions = useMemo(() => {
    const selectedSet = new Set(value.map(v => v.toLowerCase()))
    
    let filtered = ingredients.filter(ing => {
      const lowerIng = ing.toLowerCase()
      return !selectedSet.has(lowerIng)
    })

    // If there's a search query, filter by it
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(ing => {
        const lowerIng = ing.toLowerCase()
        return lowerIng.includes(query)
      })
    }

    return filtered.slice(0, 15) // Limit to 15 suggestions
  }, [searchQuery, ingredients, value])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setSearchQuery(newQuery)
    setIsOpen(true)
    setHighlightedIndex(-1)
  }

  // Handle selecting an ingredient
  const handleSelect = (ingredient: string, e?: React.MouseEvent) => {
    // Prevent blur event from firing when clicking dropdown item
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (maxSelections && value.length >= maxSelections) {
      return
    }
    
    if (!value.includes(ingredient)) {
      onChange([...value, ingredient])
    }
    
    setSearchQuery('')
  }

  // Handle removing an ingredient
  const handleRemove = (ingredient: string) => {
    onChange(value.filter(ing => ing !== ingredient))
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredOptions.length === 0) {
      if (e.key === 'Enter' && searchQuery.trim()) {
        // Try to find exact match
        const exactMatch = ingredients.find(
          ing => ing.toLowerCase() === searchQuery.toLowerCase()
        )
        if (exactMatch && !value.includes(exactMatch)) {
          handleSelect(exactMatch)
        }
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
    }
  }

  // Handle focus
  const handleFocus = () => {
    setIsOpen(true)
  }

  // Handle blur - delay to allow clicks on dropdown
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Check if the new focus target is within our container
    const relatedTarget = e.relatedTarget as Node | null
    if (containerRef.current && containerRef.current.contains(relatedTarget)) {
      // Focus is moving to an element inside our container, don't close
      return
    }
    
    // Delay to allow click events to fire
    setTimeout(() => {
      // Double-check that we're not focused on something in the container
      if (document.activeElement && containerRef.current?.contains(document.activeElement)) {
        return
      }
      setIsOpen(false)
      setHighlightedIndex(-1)
    }, 200)
  }

  // Close dropdown when clicking outside
  // useEffect(() => {
  //   const handleClickOutside = (event: MouseEvent) => {
  //     const target = event.target as Node
  //     if (
  //       (containerRef.current &&
  //       !containerRef.current.contains(target)) ||
  //       (dropdownRef.current &&
  //       !dropdownRef.current.contains(target))
  //     ) {
  //       // setIsOpen(false)
  //       setHighlightedIndex(-1)
  //     }
  //   }

  //   document.addEventListener('mousedown', handleClickOutside)
  //   return () => document.removeEventListener('mousedown', handleClickOutside)
  // }, [])

  // Highlight matching text
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200">{part}</mark>
      ) : (
        part
      )
    )
  }

  const isMaxed = maxSelections ? value.length >= maxSelections : false

  return (
    <div ref={containerRef} className="w-full">
      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {value.map((ingredient) => (
            <div
              key={ingredient}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-opacity-10 text-sm font-medium border-2 border-gray-200"
            >
              <span className="capitalize">{ingredient}</span>
              <button
                type="button"
                onClick={() => handleRemove(ingredient)}
                className="hover:bg-[var(--gg-primary)] hover:bg-opacity-20 rounded-full p-0.5 transition-colors"
                aria-label={`Remove ${ingredient}`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={isMaxed ? 'Maximum selections reached' : placeholder}
          disabled={isMaxed || isLoading}
          className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
            isMaxed
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : 'border-gray-200 bg-white hover:border-[var(--gg-primary)] hover:border-opacity-50 focus:border-[var(--gg-primary)] focus:outline-none'
          }`}
        />

        {/* Dropdown */}
        {isOpen && !isLoading && filteredOptions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto"
          >
            {filteredOptions.map((ingredient, index) => (
              <button
                key={ingredient}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault() // Prevent input blur
                  handleSelect(ingredient, e)
                }}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                  index === highlightedIndex ? 'bg-gray-100' : ''
                } ${index === 0 ? 'rounded-t-xl' : ''} ${
                  index === filteredOptions.length - 1 ? 'rounded-b-xl' : ''
                }`}
              >
                <span className="gg-text-body capitalize">
                  {highlightText(ingredient, searchQuery)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* No results message */}
        {isOpen && !isLoading && searchQuery.trim() && filteredOptions.length === 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-lg p-4">
            <p className="gg-text-body text-gray-500 text-sm">
              No ingredients found matching &quot;{searchQuery}&quot;
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--gg-primary)]"></div>
          </div>
        )}
      </div>

      {/* Selection count */}
      {maxSelections && (
        <p className="gg-text-body text-sm mt-2 text-gray-600">
          {value.length}/{maxSelections} selected
        </p>
      )}
    </div>
  )
}


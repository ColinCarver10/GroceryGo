'use client'

import React from 'react'
import type { MealPlanRecipe, Recipe } from '@/types/database'
import MealSlotCard from './MealSlotCard'

export interface MealColumnProps {
  mealType: 'breakfast' | 'lunch' | 'dinner'
  meals: (MealPlanRecipe & { recipe: Recipe })[]
  colorClasses: {
    bg: string
    border: string
    text: string
    icon: string
    emptyText: string
  }
  icon: React.ReactNode
  favoriteRecipes: Set<string>
  onRecipeClick: (recipe: Recipe, slots: MealPlanRecipe[]) => void
  onReplace: (recipeId: string, mealType?: string | null) => Promise<void>
  onToggleFavorite: (recipeId: string, isFavorite: boolean) => Promise<void>
  showMobileHeader?: boolean
  minHeight?: string
}

export default function MealColumn({
  mealType,
  meals,
  colorClasses,
  icon,
  favoriteRecipes,
  onRecipeClick,
  onReplace,
  onToggleFavorite,
  showMobileHeader = false,
  minHeight = ''
}: MealColumnProps) {
  const mealTypeLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1)
  
  return (
    <>
      {/* Mobile header - only shown when showMobileHeader is true */}
      {showMobileHeader && (
        <div className="lg:hidden">
          <div className="flex items-center gap-2 mb-2 px-2">
            {icon}
            <h4 className={`text-sm font-bold ${colorClasses.text} uppercase tracking-wider`}>
              {mealTypeLabel}
            </h4>
          </div>
        </div>
      )}
      
      {/* Meal cards container */}
      <div className={`${colorClasses.bg} ${colorClasses.border} rounded-lg p-4 ${minHeight} flex flex-col`}>
        {meals.length > 0 ? (
          <div className="space-y-3 flex-1">
            {meals.map((mpr) => (
              <MealSlotCard
                key={mpr.id}
                mealPlanRecipe={mpr}
                favoriteRecipes={favoriteRecipes}
                onRecipeClick={onRecipeClick}
                onReplace={onReplace}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        ) : (
          <p className={`text-sm ${colorClasses.emptyText} italic py-2 text-center`}>
            No {mealType} planned
          </p>
        )}
      </div>
    </>
  )
}

// Meal type configuration with colors and icons
export const mealTypeConfig = {
  breakfast: {
    colorClasses: {
      bg: 'bg-gradient-to-br from-yellow-50 to-yellow-100/50',
      border: 'border-2 border-yellow-200',
      text: 'text-yellow-900',
      icon: 'text-yellow-600',
      emptyText: 'text-yellow-700/60'
    },
    icon: (
      <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  },
  lunch: {
    colorClasses: {
      bg: 'bg-gradient-to-br from-orange-50 to-orange-100/50',
      border: 'border-2 border-orange-200',
      text: 'text-orange-900',
      icon: 'text-orange-600',
      emptyText: 'text-orange-700/60'
    },
    icon: (
      <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  dinner: {
    colorClasses: {
      bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50',
      border: 'border-2 border-blue-200',
      text: 'text-blue-900',
      icon: 'text-blue-600',
      emptyText: 'text-blue-700/60'
    },
    icon: (
      <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    )
  }
}


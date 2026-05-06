interface MealSelection {
  breakfast: number
  lunch: number
  dinner: number
}

export type SelectedSavedRecipeIds = {
  breakfast: string[]
  lunch: string[]
  dinner: string[]
}

export function mergeSelectedSavedWithAICandidates(params: {
  distinctCounts: MealSelection
  selectedSavedRecipeIds: SelectedSavedRecipeIds
  aiCandidateIds: SelectedSavedRecipeIds
}): SelectedSavedRecipeIds {
  const mergeForType = (mealType: keyof SelectedSavedRecipeIds) => {
    const maxCount = Math.max(params.distinctCounts[mealType], 0)
    const dedupedSaved = Array.from(new Set(params.selectedSavedRecipeIds[mealType])).slice(0, maxCount)
    const remaining = Math.max(maxCount - dedupedSaved.length, 0)
    const dedupedAI = Array.from(new Set(params.aiCandidateIds[mealType])).filter((id) => !dedupedSaved.includes(id))
    return [...dedupedSaved, ...dedupedAI.slice(0, remaining)]
  }

  return {
    breakfast: mergeForType('breakfast'),
    lunch: mergeForType('lunch'),
    dinner: mergeForType('dinner')
  }
}

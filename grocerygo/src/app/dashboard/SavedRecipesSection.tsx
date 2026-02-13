import { getSavedRecipesData } from './actions'
import SavedRecipesClient from './SavedRecipesClient'

export default async function SavedRecipesSection({ userId }: { userId: string }) {
  const data = await getSavedRecipesData(userId)

  return (
    <SavedRecipesClient
      userId={userId}
      savedRecipes={data.savedRecipes}
    />
  )
}

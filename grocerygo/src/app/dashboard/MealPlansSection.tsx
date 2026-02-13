import { getMealPlansPageData } from './actions'
import MealPlansClient from './MealPlansClient'

export default async function MealPlansSection({ userId }: { userId: string }) {
  const data = await getMealPlansPageData(userId)

  return (
    <MealPlansClient
      mealPlans={data.mealPlans}
      totalMealPlans={data.totalMealPlans}
      currentPage={data.currentPage}
      pageSize={data.pageSize}
    />
  )
}

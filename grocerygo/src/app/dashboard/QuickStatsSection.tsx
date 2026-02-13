import { getQuickStatsData } from './actions'

export default async function QuickStatsSection({ userId }: { userId: string }) {
  const stats = await getQuickStatsData(userId)

  return (
    <div className="gg-card">
      <h2 className="gg-heading-section mb-6">Quick Stats</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="gg-text-body text-sm">Total Meal Plans</span>
          <span className="text-2xl font-bold text-[var(--gg-primary)]">
            {stats.totalMealPlans}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="gg-text-body text-sm">Total Meals Planned</span>
          <span className="text-2xl font-bold text-[var(--gg-primary)]">
            {stats.totalMealsPlanned}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="gg-text-body text-sm">Saved Recipes</span>
          <span className="text-2xl font-bold text-[var(--gg-primary)]">
            {stats.savedRecipesCount}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="gg-text-body text-sm">This Month</span>
          <span className="text-2xl font-bold text-[var(--gg-primary)]">
            {stats.plansThisMonth}
          </span>
        </div>
        {stats.feedbackSummary.ratedMealPlansCount > 0 && (
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="gg-text-body text-sm">Rated Meal Plans</span>
              <span className="text-2xl font-bold text-[var(--gg-primary)]">
                {stats.feedbackSummary.ratedMealPlansCount}
              </span>
            </div>
            {stats.feedbackSummary.averageRating !== null && (
              <div className="flex items-center justify-between">
                <span className="gg-text-body text-sm">Average Rating</span>
                <span className="text-2xl font-bold text-green-500">
                  {stats.feedbackSummary.averageRating.toFixed(1)} / 5
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

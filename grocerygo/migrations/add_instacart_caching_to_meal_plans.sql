-- Add Instacart link caching fields to meal_plans table
-- This allows us to cache the Instacart link per meal plan instead of regenerating it every time

ALTER TABLE meal_plans
ADD COLUMN instacart_link TEXT,
ADD COLUMN instacart_link_expires_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient lookup
CREATE INDEX idx_meal_plans_instacart_expires ON meal_plans(instacart_link_expires_at);

-- Add comment to document the purpose
COMMENT ON COLUMN meal_plans.instacart_link IS 'Cached Instacart shopping link URL for this meal plan';
COMMENT ON COLUMN meal_plans.instacart_link_expires_at IS 'Expiration timestamp for the cached Instacart link';

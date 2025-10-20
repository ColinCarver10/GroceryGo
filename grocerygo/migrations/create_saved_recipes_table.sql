-- Create saved_recipes table
-- This table stores recipes that users have favorited/saved

CREATE TABLE IF NOT EXISTS saved_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  
  -- Ensure a user can't save the same recipe twice
  UNIQUE(user_id, recipe_id)
);

-- Add indexes for performance
CREATE INDEX idx_saved_recipes_user_id ON saved_recipes(user_id);
CREATE INDEX idx_saved_recipes_recipe_id ON saved_recipes(recipe_id);

-- Enable Row Level Security
ALTER TABLE saved_recipes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own saved recipes
CREATE POLICY "Users view own saved recipes"
  ON saved_recipes FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- Users can only save recipes for themselves
CREATE POLICY "Users insert own saved recipes"
  ON saved_recipes FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

-- Users can only delete their own saved recipes
CREATE POLICY "Users delete own saved recipes"
  ON saved_recipes FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Add comment for documentation
COMMENT ON TABLE saved_recipes IS 'Stores recipes that users have favorited/saved for future reference';
COMMENT ON COLUMN saved_recipes.user_id IS 'Supabase auth user ID';
COMMENT ON COLUMN saved_recipes.recipe_id IS 'Reference to the saved recipe';
COMMENT ON COLUMN saved_recipes.notes IS 'Optional user notes about why they saved this recipe';


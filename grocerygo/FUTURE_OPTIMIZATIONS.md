# Future Optimizations

## Recipe Deduplication with Vector Search

### Current State
- ✅ Recipes are created fresh for each meal plan
- ✅ No database lookups (fast and simple)
- ⚠️ Recipe duplication exists (acceptable for MVP)

### When to Implement
Consider adding vector-based recipe matching when:
- You have 100+ active users
- Database has 1000+ recipes
- Recipe duplication becomes noticeable
- You want to build recipe recommendations

### Implementation Plan

#### 1. Add pgvector Extension

```sql
-- Enable pgvector in Supabase
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to recipes table
ALTER TABLE recipes ADD COLUMN embedding vector(1536);

-- Add index for similarity search (HNSW is faster than IVFFlat for most cases)
CREATE INDEX ON recipes USING hnsw (embedding vector_cosine_ops);
```

#### 2. Generate Embeddings

Two approaches:

**Option A: OpenAI Embeddings** (Recommended)
```typescript
import OpenAI from 'openai'

async function generateRecipeEmbedding(recipe: {
  name: string
  ingredients: Array<{item: string, quantity: string}>
}) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  
  // Create searchable text
  const searchText = `${recipe.name}. Ingredients: ${
    recipe.ingredients.map(i => i.item).join(', ')
  }`
  
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small', // Cheaper and faster
    input: searchText,
  })
  
  return embedding.data[0].embedding
}
```

**Option B: Local Embeddings** (Free but slower)
```typescript
// Use sentence-transformers via a Python API or local model
// Good for: Self-hosted, no API costs
// Cons: Need to run separate service
```

#### 3. Update Recipe Creation

```typescript
// In createMealPlanFromAI()

for (const aiRecipe of aiResponse.recipes) {
  // Generate embedding
  const embedding = await generateRecipeEmbedding(aiRecipe)
  
  // Search for similar recipes
  const { data: similarRecipes } = await supabase.rpc(
    'match_recipes',
    {
      query_embedding: embedding,
      match_threshold: 0.8, // 80% similarity
      match_count: 1
    }
  )
  
  if (similarRecipes && similarRecipes.length > 0) {
    // Recipe is similar enough - reuse it
    const existingRecipeId = similarRecipes[0].id
    recipeIds.push(existingRecipeId)
    
    // Increment usage counter
    await supabase
      .from('recipes')
      .update({ 
        times_used: supabase.sql`times_used + 1` 
      })
      .eq('id', existingRecipeId)
  } else {
    // Create new recipe with embedding
    const { data: newRecipe } = await supabase
      .from('recipes')
      .insert({
        name: aiRecipe.name,
        ingredients: aiRecipe.ingredients,
        steps: aiRecipe.steps,
        embedding: embedding,
        times_used: 1
      })
      .select()
      .single()
    
    if (newRecipe) {
      recipeIds.push(newRecipe.id)
    }
  }
}
```

#### 4. Create Matching Function

```sql
-- Add to Supabase SQL Editor
CREATE OR REPLACE FUNCTION match_recipes(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  name text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    recipes.id,
    recipes.name,
    1 - (recipes.embedding <=> query_embedding) as similarity
  FROM recipes
  WHERE 1 - (recipes.embedding <=> query_embedding) > match_threshold
  ORDER BY recipes.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

#### 5. Backfill Existing Recipes

```typescript
// One-time migration script
async function backfillRecipeEmbeddings() {
  const supabase = createClient()
  
  // Get all recipes without embeddings
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, ingredients')
    .is('embedding', null)
  
  for (const recipe of recipes) {
    const embedding = await generateRecipeEmbedding(recipe)
    
    await supabase
      .from('recipes')
      .update({ embedding })
      .eq('id', recipe.id)
    
    // Rate limit: Wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}
```

### Cost Analysis

**OpenAI Embeddings (text-embedding-3-small):**
- Cost: $0.02 per 1M tokens
- Average recipe: ~50 tokens
- 1000 recipes: ~50,000 tokens = $0.001
- Very affordable!

**Storage:**
- pgvector embeddings: 1536 dimensions × 4 bytes = 6KB per recipe
- 10,000 recipes = 60MB (negligible)

### Alternative: Simple Hash-Based Matching

If you want something simpler than vectors:

```typescript
// Create hash from ingredients only
function createIngredientHash(ingredients: Array<{item: string}>) {
  const normalized = ingredients
    .map(i => i.item.toLowerCase().trim())
    .sort()
    .join('|')
  
  return crypto.createHash('md5').update(normalized).digest('hex')
}

// Add column
ALTER TABLE recipes ADD COLUMN ingredient_hash TEXT;
CREATE INDEX idx_recipes_ingredient_hash ON recipes(ingredient_hash);

// Match exactly on ingredient list
const hash = createIngredientHash(aiRecipe.ingredients)
const { data: existing } = await supabase
  .from('recipes')
  .select('id')
  .eq('ingredient_hash', hash)
  .single()
```

**Pros:**
- No API costs
- Fast and simple
- Exact ingredient matching

**Cons:**
- No fuzzy matching
- "1 cup flour" ≠ "2 cups flour" (different quantities)
- Won't catch similar recipes with slight variations

### Recommended Approach

1. **Now (MVP):** Current implementation (no deduplication)
2. **100 users:** Add ingredient hash matching (simple and free)
3. **1000+ users:** Upgrade to vector embeddings (intelligent matching)

### Monitoring

Track these metrics to know when to optimize:
```sql
-- Count total recipes
SELECT COUNT(*) FROM recipes;

-- Count recipes per user (average)
SELECT AVG(recipe_count) FROM (
  SELECT user_id, COUNT(*) as recipe_count
  FROM meal_plans
  JOIN meal_plan_recipes ON meal_plans.id = meal_plan_recipes.meal_plan_id
  GROUP BY user_id
) as counts;

-- Find duplicate recipe names
SELECT name, COUNT(*) as duplicates
FROM recipes
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY duplicates DESC;
```

### Resources

- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Supabase Vector Guide](https://supabase.com/docs/guides/ai/vector-columns)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [Vector Similarity Search](https://www.pinecone.io/learn/vector-similarity/)


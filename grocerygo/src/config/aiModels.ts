/**
 * AI Model Configuration
 * 
 * Central configuration for all AI models used throughout the application.
 * Update these constants to change which models are used.
 * 
 * Model Types:
 * - REGULAR_MODEL: Used for general AI tasks (meal plan generation, recipe replacement, etc.)
 * - SMALL_MODEL: Used for generating embedding prompts (lightweight tasks)
 * - EMBEDDED_MODEL: Used for generating embeddings (vector search)
 */

// Regular model - used for most AI tasks
// Options: 'gpt-5', 'gpt-5.2', 'gpt-4o', 'gpt-4-turbo', etc.
export const REGULAR_MODEL = 'gpt-5.2'

// Small model - used for generating embedding prompts
// Options: 'gpt-4.1-nano', 'gpt-4o-mini', 'gpt-3.5-turbo', etc.
export const SMALL_MODEL = 'gpt-4.1-nano'

// Embedded model - used for generating embeddings
// Options: 'text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002', etc.
export const EMBEDDED_MODEL = 'text-embedding-3-small'


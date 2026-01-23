/**
 * Cafe Approver Agent Constants
 * Configuration thresholds and limits
 */

// =============================================================================
// CLEAR AUTO-APPROVE THRESHOLDS
// If BOTH conditions are met, auto-approve without Claude API
// =============================================================================
export const CLEAR_MATCH_NAME_THRESHOLD = 85; // >85% name similarity = definitely same cafe
export const CLEAR_MATCH_DISTANCE_METERS = 100; // <100m = definitely right location

// =============================================================================
// CLEAR FLAG-FOR-REVIEW THRESHOLDS
// If EITHER condition is met, flag for manual review
// =============================================================================
export const CLEAR_MISMATCH_NAME_THRESHOLD = 50; // <50% name similarity = probably different cafe
export const CLEAR_MISMATCH_DISTANCE_METERS = 500; // >500m = probably wrong location

// =============================================================================
// BORDERLINE ZONE
// Values between clear match and clear mismatch → use Claude API
// Name: 50-85% similarity
// Distance: 100-500m
// =============================================================================

// =============================================================================
// OPERATIONAL LIMITS
// =============================================================================
export const MAX_RETRY_ATTEMPTS = 3; // Scraper retry attempts
export const RETRY_BASE_DELAY_MS = 2000; // 2 seconds base delay for exponential backoff
export const MAX_SUBMISSIONS_PER_RUN = 10; // Default limit per agent run
export const SCRAPER_TIMEOUT_MS = 30000; // 30 seconds timeout for scraping

// =============================================================================
// DUPLICATE DETECTION
// =============================================================================
export const DUPLICATE_CHECK_RADIUS_METERS = 200; // Check for existing cafes within this radius
export const DUPLICATE_NAME_THRESHOLD = 80; // Name similarity to consider as duplicate

// =============================================================================
// CLAUDE API CONFIGURATION
// =============================================================================
export const CLAUDE_MODEL = 'claude-3-haiku-20240307'; // Fast and cost-effective for simple decisions
export const CLAUDE_MAX_TOKENS = 500; // Enough for decision + reasoning

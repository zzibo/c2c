/**
 * Cafe Approver Agent Constants
 */

// Classification thresholds (used in validation.ts)
export const CLEAR_MATCH_NAME_THRESHOLD = 85;
export const CLEAR_MATCH_DISTANCE_METERS = 100;
export const CLEAR_MISMATCH_NAME_THRESHOLD = 50;
export const CLEAR_MISMATCH_DISTANCE_METERS = 500;

// Hard rejection thresholds (reject without calling Claude)
export const HARD_REJECT_NAME_THRESHOLD = 40;
export const HARD_REJECT_DISTANCE_METERS = 1000;

// Duplicate detection
export const DUPLICATE_CHECK_RADIUS_METERS = 200;
export const DUPLICATE_NAME_THRESHOLD = 80;

// Operational limits
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_BASE_DELAY_MS = 2000;
export const MAX_SUBMISSIONS_PER_RUN = 10;
export const SCRAPER_TIMEOUT_MS = 30000;

// Claude API
export const CLAUDE_MODEL = 'claude-3-haiku-20240307';
export const CLAUDE_MAX_TOKENS = 500;

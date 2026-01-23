/**
 * Cafe Approver Agent Types
 * TypeScript interfaces for the approval workflow
 */

export interface Coordinate {
  lat: number;
  lng: number;
}

/**
 * A pending submission from user_submitted_cafes table
 */
export interface PendingSubmission {
  id: string;
  name: string;
  google_maps_link: string;
  location: string; // PostGIS POINT format: "POINT(lng lat)"
  submitted_by: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_notes: string | null;
  approved_cafe_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Parsed submission with extracted coordinates
 */
export interface ParsedSubmission extends Omit<PendingSubmission, 'location'> {
  location: Coordinate;
}

/**
 * Data scraped from Google Maps
 */
export interface ScrapedCafeData {
  name: string;
  address: string;
  location: Coordinate;
  phone?: string;
  website?: string;
  photos: string[];
  hours?: Record<string, string>;
  rating?: number;
  totalReviews?: number;
}

/**
 * Classification result for a submission
 */
export type SubmissionClassification = 'clear_match' | 'clear_mismatch' | 'borderline';

/**
 * Validation result comparing submission to scraped data
 */
export interface ValidationResult {
  nameMatchScore: number; // 0-100 percentage
  distanceMeters: number;
  classification: SubmissionClassification;
}

/**
 * Claude API decision for borderline cases
 */
export interface ClaudeDecision {
  approve: boolean;
  reasoning: string;
}

/**
 * Result of processing a single submission
 */
export interface ProcessingResult {
  submissionId: string;
  success: boolean;
  action: 'approved' | 'rejected' | 'flagged' | 'skipped' | 'error';
  cafeId?: string; // If approved and cafe created/linked
  notes: string;
  nameMatchScore?: number;
  distanceMeters?: number;
  usedClaude?: boolean;
}

/**
 * Configuration for the agent
 */
export interface CafeApproverConfig {
  dryRun: boolean; // If true, don't make DB changes
  limit: number; // Max submissions to process
  verbose: boolean; // Extra logging
}

/**
 * Summary of agent run
 */
export interface AgentRunSummary {
  startedAt: Date;
  completedAt: Date;
  totalProcessed: number;
  approved: number;
  rejected: number;
  flagged: number;
  errors: number;
  claudeApiCalls: number;
  results: ProcessingResult[];
}

/**
 * Existing cafe from database (for duplicate checking)
 */
export interface ExistingCafe {
  id: string;
  name: string;
  location: string; // PostGIS POINT format
  address: string | null;
}

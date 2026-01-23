/**
 * Cafe Approver Agent - Claude API Integration
 * Uses Claude to make decisions on borderline cases
 */

import Anthropic from '@anthropic-ai/sdk';
import { Coordinate, ClaudeDecision } from './types';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS } from './constants';

// Lazy-initialized Anthropic client
let anthropicClient: Anthropic | null = null;

/**
 * Get Anthropic client (lazy initialization)
 * Returns null if ANTHROPIC_API_KEY is not set
 */
function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

interface BorderlineCase {
  submissionName: string;
  submissionLocation: Coordinate;
  scrapedName: string;
  scrapedAddress: string;
  scrapedLocation: Coordinate;
  nameMatchScore: number;
  distanceMeters: number;
}

/**
 * Build the prompt for Claude to evaluate a borderline submission
 */
function buildPrompt(data: BorderlineCase): string {
  return `You are a cafe verification assistant. A user submitted a cafe to our database, and we need to verify if it matches the Google Maps data.

## User Submission
- **Name**: "${data.submissionName}"
- **Pin Location**: (${data.submissionLocation.lat.toFixed(6)}, ${data.submissionLocation.lng.toFixed(6)})

## Google Maps Data (from the link they provided)
- **Name**: "${data.scrapedName}"
- **Address**: "${data.scrapedAddress}"
- **Location**: (${data.scrapedLocation.lat.toFixed(6)}, ${data.scrapedLocation.lng.toFixed(6)})

## Computed Metrics
- **Name Similarity**: ${data.nameMatchScore.toFixed(1)}% (based on Levenshtein distance)
- **Distance Between Pins**: ${data.distanceMeters} meters

## Context
- Name similarity of 50-85% is considered borderline (could be abbreviation, typo, or different business)
- Distance of 100-500m is considered borderline (could be imprecise pin drop or different location)
- Common reasons for mismatch: user typed informal name, Google has formal name, pin dropped on wrong building

## Your Task
Decide if this submission should be APPROVED (same cafe, minor discrepancies) or FLAGGED for manual review (likely different business or suspicious).

Respond in this exact JSON format:
{
  "approve": true or false,
  "reasoning": "Brief explanation (1-2 sentences)"
}`;
}

/**
 * Evaluate a borderline submission using Claude API
 * Returns a decision with reasoning
 */
export async function evaluateWithClaude(
  submission: { name: string; location: Coordinate },
  scraped: { name: string; address: string; location: Coordinate },
  nameMatchScore: number,
  distanceMeters: number
): Promise<ClaudeDecision> {
  const data: BorderlineCase = {
    submissionName: submission.name,
    submissionLocation: submission.location,
    scrapedName: scraped.name,
    scrapedAddress: scraped.address,
    scrapedLocation: scraped.location,
    nameMatchScore,
    distanceMeters,
  };

  const prompt = buildPrompt(data);

  // Check if Claude API is available
  const client = getAnthropicClient();
  if (!client) {
    console.warn('  ANTHROPIC_API_KEY not set - flagging borderline case for manual review');
    return {
      approve: false,
      reasoning: 'ANTHROPIC_API_KEY not configured. Borderline case flagged for manual review.',
    };
  }

  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text content from response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const responseText = textContent.text.trim();

    // Parse JSON response
    // Handle potential markdown code blocks
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Could not parse JSON from Claude response: ${responseText}`);
    }

    const decision = JSON.parse(jsonMatch[0]) as ClaudeDecision;

    // Validate response shape
    if (typeof decision.approve !== 'boolean' || typeof decision.reasoning !== 'string') {
      throw new Error(`Invalid decision format from Claude: ${JSON.stringify(decision)}`);
    }

    return decision;
  } catch (error) {
    // If Claude API fails, default to flagging for manual review
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Claude API error:', errorMessage);

    return {
      approve: false,
      reasoning: `Claude API error: ${errorMessage}. Flagged for manual review.`,
    };
  }
}

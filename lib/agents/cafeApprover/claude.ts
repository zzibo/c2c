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
  scrapedPlaceType?: string;
  nameMatchScore: number;
  distanceMeters: number;
}

/**
 * Build the prompt for Claude to evaluate a submission
 */
function buildPrompt(data: BorderlineCase): string {
  const placeTypeInfo = data.scrapedPlaceType
    ? `- **Place Type (from Google)**: "${data.scrapedPlaceType}"`
    : '- **Place Type (from Google)**: Unknown (not detected)';

  return `You are a STRICT cafe verification assistant for C2C, a cafe discovery app for remote workers. Your job is to verify if a submitted place is ACTUALLY A CAFE suitable for working.

## User Submission
- **Name**: "${data.submissionName}"
- **Pin Location**: (${data.submissionLocation.lat.toFixed(6)}, ${data.submissionLocation.lng.toFixed(6)})

## Google Maps Data (from the link they provided)
- **Name**: "${data.scrapedName}"
- **Address**: "${data.scrapedAddress}"
${placeTypeInfo}
- **Location**: (${data.scrapedLocation.lat.toFixed(6)}, ${data.scrapedLocation.lng.toFixed(6)})

## Computed Metrics
- **Name Similarity**: ${data.nameMatchScore.toFixed(1)}%
- **Distance Between Pins**: ${data.distanceMeters} meters

## STRICT VERIFICATION RULES

### 1. Place Type Check (MOST IMPORTANT)
The Place Type from Google Maps is the PRIMARY signal. Use it to decide:

**APPROVE** only these place types:
- "Coffee shop", "Cafe", "Café", "Espresso bar", "Coffee roasters"
- "Bakery" (only if it's primarily a cafe-style bakery)
- "Tea house", "Bubble tea store"

**REJECT** these place types - they are NOT cafes:
- "Restaurant", "Seafood restaurant", "American restaurant", "Italian restaurant", or ANY type of restaurant
- "Bar", "Wine bar", "Cocktail bar", "Pub", "Brewery"
- "Fast food restaurant", "Pizza restaurant", "Sandwich shop"
- "Breakfast restaurant", "Brunch restaurant" (these are restaurants, not cafes)
- "Hotel", "Landmark", "Park", "Museum", "Store", "Grocery store"
- Anything else that isn't explicitly a coffee shop or cafe

**If Place Type is "Unknown"**: Be EXTRA skeptical. Only approve if the NAME clearly indicates it's a coffee shop (e.g., contains "Coffee", "Cafe", "Espresso").

### 2. Name Verification
- The place name should indicate it's a cafe/coffee shop
- Famous restaurant names (like "Tadich Grill") are restaurants, NOT cafes
- Don't assume a place serves coffee just because it has seating

### 3. Location Match
- Distance under 500m is acceptable
- Name similarity above 70% is acceptable

## YOUR DECISION LOGIC

1. If Place Type is a restaurant type → REJECT (restaurants are not cafes)
2. If Place Type is bar/brewery/pub → REJECT
3. If Place Type is coffee shop/cafe → APPROVE (if location matches)
4. If Place Type is unknown AND name doesn't contain coffee/cafe → REJECT
5. When in doubt → REJECT (we prefer false negatives over false positives)

## OUTPUT FORMAT
Respond in this exact JSON format:
{
  "approve": true or false,
  "reasoning": "Brief explanation mentioning the place type and why it qualifies or doesn't qualify as a cafe"
}`;
}

/**
 * Evaluate a borderline submission using Claude API
 * Returns a decision with reasoning
 */
export async function evaluateWithClaude(
  submission: { name: string; location: Coordinate },
  scraped: { name: string; address: string; location: Coordinate; placeType?: string },
  nameMatchScore: number,
  distanceMeters: number
): Promise<ClaudeDecision> {
  const data: BorderlineCase = {
    submissionName: submission.name,
    submissionLocation: submission.location,
    scrapedName: scraped.name,
    scrapedAddress: scraped.address,
    scrapedLocation: scraped.location,
    scrapedPlaceType: scraped.placeType,
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

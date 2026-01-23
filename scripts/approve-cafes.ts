#!/usr/bin/env node
/**
 * Cafe Approver CLI Script
 *
 * Processes pending cafe submissions using rule-based logic + Claude API.
 *
 * Usage:
 *   npm run approve-cafes
 *   npm run approve-cafes -- --dry-run
 *   npm run approve-cafes -- --dry-run --limit 5
 *   npm run approve-cafes -- --limit 20
 *
 * Options:
 *   --dry-run    Don't make database changes (preview mode)
 *   --limit N    Process at most N submissions (default: 10)
 *   --help       Show this help message
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env.local');
  try {
    const envFile = readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach((line: string) => {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) return;

      const match = trimmed.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        value = value.replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch {
    console.warn('Warning: Could not load .env.local, using existing process.env');
  }
}

// Load env before imports that need it
loadEnvFile();

// Parse command line arguments
function parseArgs(): { dryRun: boolean; limit: number; help: boolean } {
  const args = process.argv.slice(2);
  const result = { dryRun: false, limit: 10, help: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--limit' && args[i + 1]) {
      result.limit = parseInt(args[i + 1], 10);
      i++; // Skip the next argument
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    }
  }

  return result;
}

function showHelp() {
  console.log(`
Cafe Approver CLI - Process pending cafe submissions

USAGE:
  npm run approve-cafes [OPTIONS]

OPTIONS:
  --dry-run     Preview mode - don't make database changes
  --limit N     Process at most N submissions (default: 10)
  --help, -h    Show this help message

EXAMPLES:
  npm run approve-cafes                    # Process up to 10 submissions
  npm run approve-cafes -- --dry-run       # Preview without changes
  npm run approve-cafes -- --limit 5       # Process only 5 submissions
  npm run approve-cafes -- --dry-run --limit 3

ENVIRONMENT:
  Requires .env.local with:
  - NEXT_PUBLIC_SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - ANTHROPIC_API_KEY (for borderline cases)
`);
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Validate required environment variables
  const requiredEnvVars = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const optionalEnvVars = ['ANTHROPIC_API_KEY'];

  const missingRequired = requiredEnvVars.filter((v) => !process.env[v]);
  if (missingRequired.length > 0) {
    console.error('Error: Missing required environment variables:');
    missingRequired.forEach((v) => console.error(`  - ${v}`));
    console.error('\nPlease add them to .env.local');
    process.exit(1);
  }

  // Warn about optional vars (only needed for borderline cases)
  const missingOptional = optionalEnvVars.filter((v) => !process.env[v]);
  if (missingOptional.length > 0) {
    console.warn('Warning: Missing optional environment variables:');
    missingOptional.forEach((v) => console.warn(`  - ${v}`));
    console.warn('Borderline cases will be flagged for manual review instead of using Claude API.\n');
  }

  console.log('');
  console.log('================================');
  console.log('  C2C Cafe Approver Agent');
  console.log('================================');
  console.log('');

  if (args.dryRun) {
    console.log('MODE: DRY RUN (no database changes will be made)');
  } else {
    console.log('MODE: LIVE (database will be updated)');
  }
  console.log(`LIMIT: ${args.limit} submissions`);
  console.log('');

  // Dynamic import to ensure env is loaded first
  const { runCafeApproverAgent } = await import('../lib/agents/cafeApprover');

  const summary = await runCafeApproverAgent({
    dryRun: args.dryRun,
    limit: args.limit,
    verbose: true,
  });

  // Exit code based on results
  if (summary.errors > 0) {
    console.log(`\nCompleted with ${summary.errors} error(s).`);
    process.exit(1);
  }

  console.log('\nCompleted successfully.');
  process.exit(0);
}

main().catch((error) => {
  console.error('\nFatal error:', error);
  process.exit(1);
});

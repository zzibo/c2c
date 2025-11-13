# Seed SF Cafes Script

This script populates your database with cafes from San Francisco by generating random points and querying the Geoapify API.

## Setup

1. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

2. **Install tsx** (TypeScript executor):
   ```bash
   npm install --save-dev tsx
   ```

3. **Ensure your `.env.local` file has**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   GEOAPIFY_API_KEY=your_key_here
   ```

## Usage

Run the seeding script:

```bash
npm run seed-cafes
```

Or directly with tsx:

```bash
npx tsx scripts/seed-sf-cafes.ts
```

## How It Works

1. **Generates random points** within San Francisco bounds
2. **Queries Geoapify API** for cafes near each point (2-mile radius)
3. **Stores cafes in Supabase** database (skips duplicates)
4. **Respects rate limits**: 
   - Free tier: 3,000 requests/day
   - Script uses 90% of limit (2,700 requests) to be safe
   - 2-second delay between requests

## Configuration

Edit `scripts/seed-sf-cafes.ts` to adjust:

- `POINTS_TO_SEARCH`: Number of random points (default: 50)
- `DELAY_BETWEEN_REQUESTS`: Milliseconds between requests (default: 2000)
- `SF_BOUNDS`: Geographic bounds of San Francisco

## Output

The script will show:
- Current cafe count in database
- Progress for each search point
- New cafes added
- Cache hits (points that already have cafes in DB)
- Final summary with total cafes added

## Example Output

```
🌱 Starting San Francisco cafe seeding...

📊 Current cafes in database: 0

📍 Generated 50 random points within SF bounds
   Bounds: 37.7081 to 37.8324 lat, -122.5150 to -122.3647 lng

⚠️  Free tier limit: 3000 requests/day
   Safe limit: 2700 requests

Starting searches...

[1/50] Searching: 37.7749, -122.4194
   ✅ Found 25 cafes, 25 new
[2/50] Searching: 37.7845, -122.4092
   ✅ Found 18 cafes, 12 new
...

📊 SEEDING SUMMARY
============================================================
📍 Points searched: 50
☕ Cafes found: 850
🆕 New cafes added: 450
💾 Total cafes in DB: 0 → 450 (+450)
📈 Cache hits: 15
❌ Errors: 0
🔌 API calls made: 50
📊 Remaining API quota: 2950 requests
============================================================

✅ Seeding completed successfully!
```

## Tips

- **First run**: Will add many cafes (most are new)
- **Subsequent runs**: Will mostly hit cache (cafes already in DB)
- **Run multiple times**: Spread across different days to maximize coverage
- **Adjust points**: Increase `POINTS_TO_SEARCH` for more coverage (but watch API limits)

## Troubleshooting

### "Missing Supabase credentials"
- Check `.env.local` file exists
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

### "Missing Geoapify API key"
- Add `GEOAPIFY_API_KEY` to `.env.local`

### "Reached safe API limit"
- You've used 90% of your daily quota
- Wait until tomorrow or reduce `POINTS_TO_SEARCH`

### No cafes found
- Check API key is valid
- Verify Supabase database is set up correctly
- Check network connection



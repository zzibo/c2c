# C2C - Cafe to Code

Find the best cafes for remote work and coding sessions.

## What is C2C?

C2C helps remote workers and coffee enthusiasts discover cafes optimized for productivity. Search by location, rate cafes across 6 work-friendly categories, and find your next favorite spot.

## Features

- **Map-based discovery** - Find cafes near you with an interactive Mapbox map
- **6-category ratings** - Rate Coffee, Vibe, WiFi, Outlets, Seating, and Noise
- **User authentication** - Sign up with email (OTP-based)
- **Submit new cafes** - Add cafes that aren't in the database
- **Photo uploads** - Share photos of your favorite spots
- **Personalized vibes** - Choose your work style: Lock-in, Network, or Chill
- **Filter & search** - Find exactly what you're looking for

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Maps:** Mapbox GL JS
- **Backend:** Supabase (PostgreSQL + PostGIS + Auth)
- **Hosting:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Mapbox account (free tier)
- Supabase project

### Setup

1. Clone the repo:
```bash
git clone https://github.com/yourusername/c2c.git
cd c2c
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.local.example .env.local
```

4. Add your keys to `.env.local`:
```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...
GEOAPIFY_API_KEY=...
```

5. Run the dev server:
```bash
npm run dev
```

6. Open http://localhost:3000

## Project Structure

```
c2c/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   └── onboarding/        # User onboarding flow
├── components/
│   ├── ui/                # Reusable UI components
│   ├── map/               # Map and cafe list
│   ├── auth/              # Authentication
│   ├── cafe/              # Cafe cards and ratings
│   └── profile/           # User profile
├── lib/                   # Utilities and services
│   ├── auth/              # Auth context
│   ├── storage/           # Image storage helpers
│   └── agents/            # Background processing
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript interfaces
└── public/assets/         # Pixel art icons
```

## Contributing

We welcome contributions! Here's how to get involved:

### Good First Issues

Check out issues labeled `good first issue` for beginner-friendly tasks.

### How to Contribute

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run linting: `npm run lint`
5. Commit with a descriptive message
6. Push and open a Pull Request

### Areas We Need Help

- **UI/UX improvements** - Better mobile experience, accessibility
- **New features** - Favorites, cafe check-ins, social features
- **Testing** - Unit tests, E2E tests
- **Documentation** - API docs, component storybook
- **Bug fixes** - Check the Issues tab

### Code Style

- TypeScript strict mode
- Tailwind CSS for styling (see design system in CLAUDE.md)
- Functional components with hooks
- Clear component interfaces

## Scripts

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # Run ESLint
npm run start    # Start production server
```

## Troubleshooting

**Map not loading?**
- Check `.env.local` exists with valid Mapbox token
- Restart dev server after env changes

**Location not working?**
- Allow location permissions in browser
- Must be on HTTPS or localhost

**Auth issues?**
- Verify Supabase URL and keys
- Check Supabase dashboard for auth logs

## License

MIT

## Links

- [Report a Bug](https://github.com/zzibo/c2c/issues)
- [Request a Feature](https://github.com/zzibo/c2c/issues)
- [Technical Documentation](./CLAUDE.md)
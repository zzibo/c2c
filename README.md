# C2C (Cafe to Code) - Web Application

> Discover the best cafes for coding and remote work

## Quick Start

### 1. Get Your Mapbox API Token

1. Go to [Mapbox Account](https://account.mapbox.com/)
2. Sign up for a free account (Free tier includes 50,000 map loads/month)
3. Navigate to **Access Tokens**
4. Copy your **Default public token** OR create a new one

### 2. Set Up Environment Variables

```bash
# Copy the example file
cp .env.local.example .env.local

# Open .env.local and add your Mapbox token
# NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...your_token_here
```

Edit `.env.local`:
```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieW91ciB1c2VybmFtZSIsImEiOiJ5b3VyX3Rva2VuIn0...
```

### 3. Install Dependencies & Run

```bash
# Install all packages
npm install

# Start the development server
npm run dev
```

### 4. Open Your Browser

Navigate to: **http://localhost:3000**

You should see:
- A full-screen map
- Your current location (browser will ask for permission)
- A blue pulsing marker showing where you are
- Navigation controls to zoom in/out

---

## Project Structure

```
c2c-1/
├── app/
│   ├── globals.css          # Global styles + Tailwind
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Home page with map
├── components/
│   └── map/
│       └── MapView.tsx       # Map component with user location
├── types/
│   └── cafe.ts               # TypeScript interfaces
├── lib/                      # Utilities (coming soon)
├── hooks/                    # Custom React hooks (coming soon)
├── .env.local.example        # Environment variables template
└── README.md                 # This file
```

---

## Features Implemented ✅

- [x] Next.js 15 with App Router
- [x] TypeScript strict mode
- [x] Tailwind CSS
- [x] Mapbox GL JS integration
- [x] User location detection
- [x] Responsive map interface
- [x] Loading states
- [x] Dark mode support

---

## Next Steps (Phase 2)

### Add Sample Cafe Markers

1. Create sample cafe data
2. Display cafe markers on map
3. Click cafe to see details
4. Calculate distance from user

### Set Up Firebase

1. Create Firebase project
2. Add Firestore database
3. Set up authentication
4. Connect to app

### Build Cafe Search

1. Google Places API integration
2. Search bar component
3. Filter by distance/rating
4. List view + map view toggle

---

## Tech Stack

- **Framework**: Next.js 15 (React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Maps**: Mapbox GL JS
- **State**: React hooks (Zustand coming soon)
- **Backend**: Firebase (coming soon)

---

## Common Issues

### Map not loading?

1. Check your `.env.local` file exists
2. Verify your Mapbox token is correct
3. Restart dev server: `npm run dev`
4. Clear browser cache

### Location not showing?

1. Browser will ask for location permission - allow it
2. Check if you're on HTTPS or localhost
3. Try clicking the geolocate button (top right of map)

### TypeScript errors?

```bash
# Delete cache and reinstall
rm -rf .next node_modules
npm install
npm run dev
```

---

## Scripts

```bash
npm run dev      # Start development server with Turbopack
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## Learning Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Mapbox GL JS Docs](https://docs.mapbox.com/mapbox-gl-js/)
- [React Map GL](https://visgl.github.io/react-map-gl/)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## License

MIT

---

## What's Next?

Check out `TECHNICAL_ROADMAP.md` for the complete development plan!

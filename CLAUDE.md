# C2C Web Application - Technical Documentation

> **App Purpose**: Cafe discovery and rating platform for remote workers and coffee enthusiasts

## What is C2C?

C2C (Cafe-to-Cafe) helps users discover and rate cafes based on work-friendly criteria. Users can search for nearby cafes, view detailed ratings across 6 categories, and submit their own ratings to help others find the perfect workspace.

### Key Features (Current Implementation)
- **Interactive Map View**: Mapbox-powered map showing nearby cafes within 2 miles
- **Location-Based Search**: GPS-powered cafe discovery + name search
- **6-Category Rating System**: Coffee, Vibe, WiFi, Outlets, Seating, Noise
- **Interactive Star Ratings**: Hover-responsive UI with half-star precision
- **Expandable Cafe Cards**: Click to see detailed ratings with category icons
- **Real-time Updates**: Database-backed ratings aggregation
- **User Authentication**: Email OTP-based auth via Supabase
- **Rating Submission**: Submit and edit ratings with optional comments and photos
- **User Profiles**: Username, profile photo, vibe preference (lock-in, network, chill)
- **Onboarding Flow**: Welcome flow for new users to set up profile
- **Add New Cafes**: User-submitted cafes with AI-powered approval
- **Photo Uploads**: Image upload to Supabase Storage for ratings and profiles
- **Filtering**: Filter cafes by rating categories

---

## 🎨 DESIGN SYSTEM (CRITICAL - READ FIRST)

> **IMPORTANT**: All AI assistants MUST follow these design system rules. This ensures consistency, maintainability, and extensibility across the entire codebase.

### Color Palette & Usage

**Configured in `tailwind.config.ts`** - ONLY use these C2C brand colors + default Tailwind neutrals:

#### C2C Brand Colors (ONLY USE THESE FOR BRAND ELEMENTS)
```typescript
'c2c-base': '#f6f0e8'         // Warm off-white (page backgrounds, cards)
'c2c-orange': '#f4512c'        // Primary accent (CTAs, buttons, highlights)
'c2c-orange-dark': '#e64524'   // Hover/active states for orange elements
```

#### Allowed Neutral Colors (From Default Tailwind)
```typescript
white, black              // Pure white/black
gray-50 through gray-900  // Gray scale for text, borders, backgrounds
red-50 through red-700    // Error states only
green-50 through green-700 // Success states only
```

#### Semantic Color Rules

**✅ CORRECT Usage:**
```tsx
// C2C brand colors for branded elements
<div className="bg-c2c-base">
<button className="bg-c2c-orange hover:bg-c2c-orange-dark text-white">

// Neutrals for structure
<div className="bg-white border-gray-300 text-gray-900">
<input className="border-gray-400 focus:ring-c2c-orange text-gray-900">
<p className="text-gray-700">      // Body text
<span className="text-gray-500">  // Muted text
```

**❌ INCORRECT Usage:**
```tsx
// NEVER use amber, blue, or other Tailwind color scales
<div className="bg-amber-50">      // ❌ Use bg-c2c-base or bg-white
<button className="bg-blue-500">   // ❌ Use bg-c2c-orange
<div className="border-amber-900"> // ❌ Use border-gray-700 or border-gray-900
<p className="text-amber-900">     // ❌ Use text-gray-900

// NEVER use arbitrary color values
<div className="bg-[#f6f0e8]">     // ❌ Use bg-c2c-base

// NEVER use deprecated pixel-* colors
<div className="bg-pixel-cream">   // ❌ DEPRECATED - Use bg-c2c-base
<div className="text-pixel-dark">  // ❌ DEPRECATED - Use text-gray-900
```

#### Simplified Color System (Easy to Remember!)

### The 3 Rules

1. **Brand colors** → Only for buttons, highlights, and page backgrounds
2. **Gray scale** → Everything else (text, borders, backgrounds)
3. **Semantic colors** → Only for errors (red) and success (green)

---

### Brand Colors (3 total)

```tsx
bg-c2c-base          // Warm page backgrounds, headers
bg-c2c-orange        // Primary buttons, CTAs
hover:bg-c2c-orange-dark  // Hover on orange buttons
```

---

### Gray Scale (Use these simple rules)

**Backgrounds:**
```tsx
bg-white        // Default for cards, modals, inputs
bg-gray-50      // Subtle hover states
bg-gray-100     // Disabled backgrounds
bg-gray-200     // Cancel buttons
```

**Borders:**
```tsx
border-gray-300    // Default light borders (cards, dividers)
border-gray-400    // Input borders
border-gray-700    // Secondary button borders
border-gray-900    // Strong borders (modals, emphasis)
```

**Text:**
```tsx
text-gray-900      // Headings, labels (darkest)
text-gray-700      // Body text (default)
text-gray-500      // Muted text (timestamps, placeholders)
```

---

### Semantic Colors (Errors & Success Only)

**Errors:**
```tsx
bg-red-50 border-red-400 text-red-700    // Error messages/states
```

**Success:**
```tsx
bg-green-50 border-green-400 text-green-700  // Success messages/states
```

---

### Quick Reference Table

| Element | Pattern |
|---------|---------|
| **Primary Button** | `bg-c2c-orange hover:bg-c2c-orange-dark text-white` |
| **Secondary Button** | `bg-white border-gray-700 text-gray-900 hover:bg-gray-100` |
| **Text Input** | `bg-white border-gray-400 text-gray-900 focus:ring-c2c-orange` |
| **Card** | `bg-white border-gray-300 text-gray-900 hover:bg-gray-50` |
| **Modal** | `bg-white border-2 border-gray-900` |
| **Page Header** | `bg-c2c-base border-b-2 border-gray-300` |
| **Heading** | `text-gray-900 font-bold` |
| **Body Text** | `text-gray-700` |
| **Muted Text** | `text-gray-500` |
| **Error** | `bg-red-50 border-red-400 text-red-700` |
| **Success** | `bg-green-50 border-green-400 text-green-700` |

That's it! Everything uses either **c2c-base/orange**, **gray-X**, or **red/green for states**.

### Typography System

**Font Families** (configured in `tailwind.config.ts`):
```typescript
font-sans: 'Roboto Mono'   // Default body text
font-pixel: 'Press Start 2P' // Decorative headings (use sparingly)
font-mono: 'Roboto Mono'   // Code/numeric displays
```

**Text Sizes & Hierarchy:**
```tsx
// Headings
<h1 className="text-2xl font-bold text-gray-900">   // Page titles
<h2 className="text-xl font-bold text-gray-900">    // Section headers
<h3 className="text-lg font-semibold text-gray-900"> // Subsections

// Body Text
<p className="text-sm text-gray-700">    // Primary body
<p className="text-xs text-gray-500">    // Secondary/helper text

// Labels
<label className="text-sm font-medium text-gray-900"> // Form labels
```

### Spacing & Layout

**Consistent Spacing Scale:**
- Use Tailwind's default spacing scale (0.25rem increments)
- Prefer `space-y-*` and `gap-*` over manual `mb-*` when possible
- Standard component padding: `p-6` (24px)
- Card/Panel padding: `p-4` or `p-6`
- Section spacing: `space-y-4` or `space-y-6`

### Border & Shadow System

**Borders:**
```tsx
// Standard borders
border           // 1px solid
border-2         // 2px solid (preferred for emphasis)
border-3         // 3px solid (strong emphasis)
border-4         // 4px solid (pixel art aesthetic)

// Border radius - AVOID rounded corners for pixel art elements
rounded-none     // For pixel art components (preferred)
rounded-lg       // Only for modern UI elements (modals, inputs)
```

**Shadows:**
```typescript
// Custom pixel-art shadows (in tailwind.config.ts)
shadow-pixel:    '4px 4px 0 rgba(90, 74, 66, 0.15), 8px 8px 0 rgba(212, 130, 63, 0.1)'
shadow-pixel-sm: '2px 2px 0 rgba(90, 74, 66, 0.15), 4px 4px 0 rgba(212, 130, 63, 0.1)'
```

---

## 🧩 COMPONENT ARCHITECTURE RULES

### Component Design Principles

**1. Modularity & Reusability**
- ✅ Create small, single-responsibility components
- ✅ Use props for configuration, not duplication
- ✅ Extract common patterns into `/components/ui`
- ❌ NEVER copy-paste components with slight variations

**2. Component Structure**
```
components/
├── ui/              # Reusable primitives (Button, Input, Modal)
├── map/             # Map-specific components
├── cafe/            # Cafe-related features
├── auth/            # Authentication components
└── layout/          # Layout components (Header, Footer)
```

### Standard Component Template

```tsx
'use client'; // Only when needed (interactivity, hooks, browser APIs)

import React from 'react';
import { ComponentProps } from '@/types'; // If custom types needed

/**
 * Component description
 * @param prop1 - Description
 * @param prop2 - Description
 */
export interface MyComponentProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string; // Always allow className override
  children?: React.ReactNode;
  // ... other props
}

export function MyComponent({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: MyComponentProps) {
  // Component logic here

  return (
    <div className={`base-styles ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}
```

### UI Component Requirements

**All UI components MUST:**
1. **Accept `className` prop** for style overrides
2. **Use C2C color palette** (see Color System above - c2c-* colors + gray neutrals)
3. **Support disabled states** with `disabled:opacity-50 disabled:cursor-not-allowed`
4. **Include TypeScript interfaces** for all props
5. **Spread `...props`** to support native HTML attributes
6. **Use controlled/uncontrolled patterns** appropriately

**Example: Button Component Pattern**
```tsx
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const baseStyles = 'font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'bg-c2c-orange text-white hover:bg-c2c-orange-dark',
    secondary: 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  return (
    <button className={`${baseStyles} ${variantStyles[variant]} ${className}`} {...props} />
  );
}
```

---

## 🪝 HOOKS ARCHITECTURE

### Hook Organization

```
hooks/
├── useOnboarding.ts     # Auth-related navigation logic
├── useUpdateVibes.ts    # User vibe preference updates
└── useServiceWorker.ts  # PWA service worker registration
```

### Hook Design Rules

**✅ Good Hook Practices:**
```tsx
/**
 * Hook for X functionality
 * @returns { value, isLoading, error }
 */
export function useMyFeature() {
  const [value, setValue] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Logic here

  return {
    value,      // Data
    isLoading,  // Loading state
    error,      // Error state
    refetch,    // Action methods
  };
}
```

**❌ Bad Hook Practices:**
```tsx
// ❌ Don't return arrays (not self-documenting)
return [value, setValue]; // Use object instead

// ❌ Don't violate Rules of Hooks
if (condition) useEffect(...); // Conditional hooks

// ❌ Don't create mega-hooks that do everything
// Keep hooks focused on single responsibility
```

### Context Pattern (AuthContext Example)

```tsx
'use client';

import { createContext, useContext } from 'react';

interface MyContextType {
  value: string;
  setValue: (val: string) => void;
}

const MyContext = createContext<MyContextType | undefined>(undefined);

export function MyProvider({ children }: { children: React.ReactNode }) {
  // State management
  return <MyContext.Provider value={value}>{children}</MyContext.Provider>;
}

export function useMyContext() {
  const context = useContext(MyContext);
  if (!context) throw new Error('useMyContext must be used within MyProvider');
  return context;
}
```

---

## 📦 STATE MANAGEMENT PATTERNS

### Client State (useState, useReducer)
- Component-local state (form inputs, UI toggles)
- Temporary selections (selected cafe, expanded card)

### Context State (React Context)
- Global auth state (`AuthContext`)
- Theme/settings (if implemented)
- User profile data

### Server State (Future: React Query / SWR)
- Cafe data fetching
- Rating submissions
- Search results

**Rule:** Keep state as local as possible. Only lift to Context when 3+ components need it.

---

## 🎯 STYLING GUIDELINES

### Tailwind CSS Rules

**✅ DO:**
- Use Tailwind utility classes for ALL styling
- Group related utilities: `className="flex items-center gap-2"`
- Use C2C color tokens: `c2c-base`, `c2c-orange`, `c2c-orange-dark` + gray neutrals
- Extract repeated patterns into components

**❌ DON'T:**
- Write custom CSS files (except globals.css for fonts/resets)
- Use inline `style={{}}` unless dynamic values required
- Use arbitrary values `[#hex]` - add to tailwind.config.ts instead
- Mix Tailwind with CSS modules
- Use amber, blue, or deprecated pixel-* color scales

### Conditional Styling Pattern

```tsx
// ✅ Good - using template literals
<div className={`base-class ${isActive ? 'bg-gray-100' : 'bg-white'}`} />

// ✅ Better - using clsx/cn helper (if available)
import { cn } from '@/lib/utils';
<div className={cn('base-class', isActive && 'bg-gray-100')} />

// ❌ Bad - inline styles
<div style={{ background: isActive ? '#f3f4f6' : '#fff' }} />

// ❌ Bad - deprecated colors
<div className={`base-class ${isActive ? 'bg-amber-100' : 'bg-white'}`} />
```

---

## 🖼️ IMAGE & ASSET RULES

### Pixel Art Assets

**Location:** `/public/assets/`

**Usage:**
```tsx
import Image from 'next/image';

<Image
  src="/assets/coffee.png"
  alt="Coffee icon"
  width={24}
  height={24}
  unoptimized // REQUIRED for pixel art to prevent blur
  className="pixel-image" // Maintains sharp edges
/>
```

**Naming Convention:**
- Use kebab-case: `coffee-icon.png`
- Descriptive names: `full_star.png`, `half_star.png`, `zero_star.png`
- Group by category if needed: `icons/`, `stars/`

---

## 🔒 TYPESCRIPT RULES

### Type Safety Standards

**✅ ALWAYS:**
```tsx
// Define interfaces for all component props
export interface MyProps {
  name: string;
  count?: number; // Optional props with ?
}

// Use type imports
import type { User } from '@supabase/supabase-js';

// Type event handlers
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => { };
```

**❌ NEVER:**
```tsx
// Don't use `any`
const data: any = fetchData(); // ❌

// Don't skip prop types
export function Component(props) { } // ❌

// Don't use `as` to bypass types (unless absolutely necessary)
const user = data as User; // ⚠️ Only when type narrowing impossible
```

### Database Type Pattern

```tsx
// lib/supabase.ts
export interface Cafe {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  // ... other fields
}

export interface Rating {
  id: string;
  cafe_id: string;
  user_id: string;
  overall_rating: number;
  // ... other fields
}
```

---

## 📁 FILE & FOLDER CONVENTIONS

### Naming Rules

- **Components:** PascalCase (`MyComponent.tsx`)
- **Hooks:** camelCase with `use` prefix (`useMyHook.ts`)
- **Utils:** camelCase (`formatDate.ts`)
- **Types:** PascalCase (`CafeTypes.ts` or `types/cafe.ts`)
- **Constants:** SCREAMING_SNAKE_CASE in `constants.ts`

### Import Order

```tsx
// 1. External dependencies
import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';

// 2. Internal components
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/auth/Modal';

// 3. Utilities & hooks
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth/AuthContext';

// 4. Types
import type { Cafe } from '@/types/cafe';

// 5. Styles/assets (if any)
import '/styles/custom.css';
```

---

## ⚡ PERFORMANCE RULES

1. **Use `'use client'` sparingly** - Default to Server Components
2. **Lazy load heavy components:**
   ```tsx
   const MapView = dynamic(() => import('@/components/map/MapView'), { ssr: false });
   ```
3. **Memoize expensive calculations:**
   ```tsx
   const sortedCafes = useMemo(() => cafes.sort(...), [cafes]);
   ```
4. **Debounce search inputs** (use `useDebounce` hook)
5. **Optimize images** with Next.js `<Image>` (except pixel art - use `unoptimized`)

---

## 🚨 CRITICAL ERRORS TO AVOID

### 1. Color Inconsistency
```tsx
// ❌ WRONG - uses deprecated/non-standard colors
<div className="bg-amber-50 border-amber-900 text-amber-900">
<button className="bg-blue-500">
<div className="bg-pixel-cream border-pixel-dark">  // DEPRECATED

// ✅ CORRECT - uses C2C palette + gray neutrals
<div className="bg-c2c-base border-gray-300 text-gray-900">
<button className="bg-c2c-orange hover:bg-c2c-orange-dark text-white">
<div className="bg-white border-gray-400 text-gray-700">
```

### 2. Hardcoded Values
```tsx
// ❌ WRONG
const API_URL = 'https://api.example.com';
const MAX_RATING = 5;

// ✅ CORRECT - use env vars or constants
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const MAX_RATING = 5 as const; // Type-safe constant
```

### 3. Props Drilling (3+ Levels)
```tsx
// ❌ WRONG - passing props through 5 components
<A data={x} /> → <B data={x} /> → <C data={x} />

// ✅ CORRECT - use Context or component composition
<DataProvider value={x}>
  <C />
</DataProvider>
```

### 4. Missing Error States
```tsx
// ❌ WRONG - no error handling
const data = await fetchCafes();

// ✅ CORRECT - handle errors
try {
  const data = await fetchCafes();
} catch (error) {
  console.error('Failed to fetch cafes:', error);
  setError('Unable to load cafes. Please try again.');
}
```

---

## 📝 CODE REVIEW CHECKLIST

Before submitting any code, verify:

- [ ] Uses ONLY C2C colors (`c2c-base`, `c2c-orange`, `c2c-orange-dark`) + gray neutrals
- [ ] NO deprecated colors (amber-*, pixel-*, blue-*, etc.)
- [ ] Component has TypeScript interface
- [ ] `className` prop forwarded for extensibility
- [ ] No hardcoded colors/sizes (uses Tailwind tokens)
- [ ] Follows import order convention
- [ ] Includes error handling for async operations
- [ ] Uses `'use client'` only when needed
- [ ] Pixel art images use `unoptimized` flag
- [ ] Accessible (aria-labels, keyboard navigation)
- [ ] Mobile-responsive (tested on small screens)

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router, React 19)
- **Language**: TypeScript 5.3+
- **UI**: Tailwind CSS with C2C brand colors
- **Maps**: Mapbox GL JS (react-map-gl)
- **Icons**: Custom pixel-art PNG assets for rating categories
- **Fonts**: Roboto Mono (body), Press Start 2P (decorative)

### Backend & Database
- **Database**: Supabase (PostgreSQL with PostGIS extension)
- **Tables**:
  - `cafes`: Cafe locations, metadata, geospatial data
  - `ratings`: User ratings across 6 categories
  - `profiles`: User profiles with vibe preferences (lock-in, network, chill)
- **API**: Geoapify Places API for cafe discovery
- **Hosting**: Vercel (Next.js) + Supabase Cloud

---

## Database Schema (Supabase/PostgreSQL)

### Core Tables

**`cafes`**
```sql
- id (uuid, primary key)
- geoapify_place_id (text, unique)
- osm_id (text)
- name (text)
- address (text)
- location (geography point) -- PostGIS for geospatial queries
- phone, website (text, nullable)
- user_photos (text[])
- verified_hours (jsonb)
- first_discovered_at, last_synced_at (timestamp)
- created_at, updated_at (timestamp)
```

**`ratings`**
```sql
- id (uuid, primary key)
- cafe_id (uuid, foreign key → cafes)
- user_id (uuid, foreign key → profiles)
- coffee_rating (numeric 0-5, nullable)
- vibe_rating (numeric 0-5, nullable)
- wifi_rating (numeric 0-5, nullable)
- outlets_rating (numeric 0-5, nullable)
- seating_rating (numeric 0-5, nullable)
- noise_rating (numeric 0-5, nullable)
- overall_rating (numeric 0-5, REQUIRED)
- comment (text, nullable)
- photos (text[])
- created_at, updated_at (timestamp)
```

**`profiles`**
```sql
- id (uuid, primary key, linked to auth.users)
- username (text, unique)
- is_onboarded (boolean)
- metadata (jsonb) -- stores: { vibe: 'lock-in' | 'network' | 'chill', preferences, stats }
- created_at, updated_at (timestamp)
```

### Materialized View
**`cafe_stats`** - Pre-aggregated rating averages for performance
- Refreshed automatically on new ratings
- Provides avg_coffee, avg_vibe, avg_wifi, avg_outlets, avg_seating, avg_noise, avg_overall

### Database Functions
- `get_nearby_cafes(lat, lng, radius_meters, min_rating, limit)`: Geospatial search with rating filters
- `refresh_cafe_stats()`: Refresh materialized view
- `get_user_profile_with_stats(user_id)`: Get profile + rating statistics

---

## UI/UX Design

### Current Interface (Map View)

**Left Panel**: Cafe list with search
- Search bar (by name)
- "Nearby (2mi)" button - GPS-based search
- Results count badge
- Scrollable cafe cards showing:
  - Ranking (#1, #2, etc.)
  - Cafe name, distance, address
  - Overall star rating + review count
  - **Expandable section (click to expand)**

**Expanded Cafe View** (When clicked):
- Header: "Rate this cafe:"
- 6 rating categories with pixel-art icons + interactive stars:
  - ☕ **Coffee** (`/assets/coffee.png`)
  - 🎵 **Vibe** (`/assets/vibes.png`)
  - 📶 **WiFi** (`/assets/wifi.png`)
  - 🔌 **Outlets** (`/assets/plugs.png`)
  - 💺 **Seating** (`/assets/seats.png`)
  - 🔊 **Noise** (`/assets/noise.png`)

**Interactive Star Rating Behavior**:
- **Default**: 5 empty stars (`zero_star.png`) when rating = 0
- **Hover left half of star**: Shows half star (`half_star.png`)
- **Hover right half of star**: Shows full star (`full_star.png`)
- **Smooth gliding**: Stars update reactively as mouse moves horizontally
- **Click**: Sets rating (0.5 increments, ready for API submission)
- **Display**: Numerical rating shown (e.g., "3.5")

**Map View** (Right side):
- Mapbox custom style
- Cafe markers with custom coffee cup icon (`cafe-icon.png`)
- Selected cafe highlighted (beige pin)
- User location (blue pulsing dot)
- Geolocate + zoom controls
- **Interactions**:
  - Click marker → centers map & scrolls cafe into view in left panel
  - Click cafe card → centers map on that cafe

**Panel Controls**:
- Collapse/expand button (ChevronLeft/Right)
- Panel width: 384px (w-96) when expanded, 0 when collapsed
- Map resizes automatically

### Color Scheme & Style
- **Primary**: C2C brand colors (`bg-c2c-base`, `bg-c2c-orange`)
- **Text**: Gray scale (`text-gray-900`, `text-gray-700`)
- **Buttons**: C2C orange with dark hover states
- **Selected**: Gray-100 background, gray-700 border
- **Style**: Pixel-art aesthetic with sharp borders (no rounded corners on assets)
- **Font**: Roboto Mono (body), Press Start 2P (decorative headings)

---

## API Routes

### Cafe Discovery
- `GET /api/cafes/nearby?lat={lat}&lng={lng}` - Cafes within 2mi radius
- `GET /api/cafes/search?q={query}&lat={lat}&lng={lng}` - Search by name
- `GET /api/cafes/viewport?bounds=...` - Cafes in map viewport
- `GET /api/cafes/user-submitted` - User-submitted cafes pending approval

### Ratings
- `POST /api/ratings` - Submit a new rating
- `GET /api/ratings/check?cafeId={id}` - Check if user rated a cafe
- `GET /api/cafes/[id]/ratings` - Get ratings for a cafe
- `PUT /api/ratings/[id]` - Update a rating
- `DELETE /api/ratings/[id]` - Delete a rating

### Images
- `POST /api/images/upload` - Upload image to Supabase Storage
- `DELETE /api/images/delete` - Delete uploaded image

### Cafe Submission
- `POST /api/cafes/scrape` - Scrape cafe data from Google Maps URL
- `POST /api/admin/approve-submissions` - Admin approval for submissions

### Background Jobs
- `POST /api/cron/process-submissions` - Process pending cafe submissions

### Example Response (nearby)
```json
{
  "success": true,
  "count": 25,
  "cafes": [
    {
      "id": "uuid",
      "name": "Cafe Name",
      "location": { "lat": 37.7749, "lng": -122.4194 },
      "address": "123 Main St, San Francisco, CA",
      "ratings": {
        "coffee": 4.5,
        "vibe": 4.0,
        "wifi": 3.5,
        "outlets": 4.0,
        "seating": 3.5,
        "noise": 4.0,
        "overall": 4.0
      },
      "totalReviews": 12,
      "distance": 450
    }
  ]
}
```

---

## Component Architecture

### Key Components

**Map & Cafe Discovery**
- `components/map/MapView.tsx` - Main map interface, cafe list state, geolocation
- `components/map/CafeSidebar.tsx` - Left panel with cafe list and search
- `components/map/CafeMarker.tsx` - Map marker component
- `components/cafe/ExpandedCafeView.tsx` - Detailed cafe view with ratings
- `components/cafe/RatingPanel.tsx` - Rating submission form
- `components/cafe/AddCafeModal.tsx` - User cafe submission form

**UI Components**
- `components/ui/StarRating.tsx` - Interactive star rating (half-star precision)
- `components/ui/ImageUpload.tsx` - Photo upload with preview
- `components/ui/ImageCarousel.tsx` - Photo gallery viewer
- `components/ui/FilterModal.tsx` - Cafe filtering options
- `components/ui/Button.tsx` - Styled button variants
- `components/ui/Input.tsx` - Form input component
- `components/ui/Toast.tsx` - Notification toasts
- `components/ui/ConfirmModal.tsx` - Confirmation dialogs

**Authentication**
- `components/auth/AuthModal.tsx` - Login/signup modal
- `components/auth/EmailStep.tsx` - Email input step
- `components/auth/OTPStep.tsx` - OTP verification step
- `components/auth/WelcomeBackHandler.tsx` - Returning user handler

**Profile & Layout**
- `components/layout/AppHeader.tsx` - Main app header
- `components/layout/ProfileModal.tsx` - User profile dropdown
- `components/layout/ProfileManagementModal.tsx` - Edit profile settings
- `components/profile/ProfileAvatar.tsx` - User avatar display
- `components/profile/ProfilePhotoUpload.tsx` - Profile photo upload

**Onboarding**
- `components/onboarding/UsernameStep.tsx` - Username selection
- `components/onboarding/VibeSelection.tsx` - Vibe preference picker
- `components/onboarding/VibeCard.tsx` - Individual vibe option card

### Library & Services

**`lib/supabase.ts`** / **`lib/supabase-client.ts`** / **`lib/supabase-server.ts`**
- Supabase client configuration (browser and server)
- TypeScript types for database tables

**`lib/auth.ts`** / **`lib/auth-server.ts`**
- Authentication context and utilities

**`lib/storage/`**
- `imageStorage.ts` - Rating image uploads
- `profilePhotos.ts` - Profile photo uploads
- `mapStorage.ts` - Map position persistence

**`lib/agents/cafeApprover/`**
- AI-powered cafe submission approval agent
- Uses Claude API for validation

**`types/cafe.ts`**
- Core TypeScript interfaces:
  - `Cafe`: Full cafe data
  - `CafeRatings`: 6 rating categories + overall
  - `Coordinate`: lat/lng

---

## Environment Variables

Required in `.env.local`:
```bash
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
GEOAPIFY_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...
```

---

## Development Workflow

### Development Commands
```bash
npm run dev          # Start Next.js dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint check
```

### Code Style
- TypeScript strict mode enabled
- Tailwind CSS for all styling (no CSS modules)
- Component files use `'use client'` directive when needed (map interactivity)
- PNG assets use `unoptimized` flag + `pixel-image` class

---

## Completed Features

### Phase 1: Core MVP (Done)
- Interactive map with cafe discovery
- 6-category rating system
- Location-based search + name search
- Cafe cards with expandable details

### Phase 2: Rating Submission (Done)
- API endpoint: `POST /api/ratings`
- Form validation (overall rating required, others optional)
- Photo upload to Supabase Storage
- Edit and delete ratings

### Phase 3: User Authentication (Done)
- Supabase Auth with email OTP
- Protected routes for rating submission
- User profile with photo upload
- Onboarding flow (username + vibe preference)

### Phase 4: Cafe Submission (Done)
- User-submitted cafe form
- AI-powered approval agent (Claude)
- Admin approval workflow
- Cron job for processing submissions

---

## Future Features (Roadmap)

### Phase 5: Social Features
- View user's rating history
- Follow other users
- Cafe favorites/bookmarks
- Activity feed

### Phase 6: AI-Powered Recommendations
- Natural language search: "quiet cafe with good wifi"
- Personalized recommendations based on vibe preference
- Semantic search using embeddings

### Phase 7: Mobile & PWA
- Progressive Web App with offline support
- Push notifications for new ratings
- Mobile-optimized experience

---

## Key Implementation Details

### Geospatial Queries
- PostGIS `geography` type for precise distance calculations
- `ST_DWithin` for radius searches
- Distance returned in meters, converted to miles in frontend

### Rating Aggregation Strategy
- Materialized view (`cafe_stats`) for performance
- Refreshed on each new rating insertion
- Avoids expensive aggregations on every query
- Displays 0.0 for categories with no ratings

### Interactive Star Rating Algorithm
```typescript
// In StarRating.tsx
const handleMouseMove = (e: MouseEvent) => {
  const rect = containerRef.current.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const starWidth = rect.width / maxStars;
  const starIndex = Math.floor(x / starWidth);
  const positionInStar = (x % starWidth) / starWidth;

  // Left half = 0.5, Right half = 1.0
  const rating = positionInStar < 0.5
    ? starIndex + 0.5
    : starIndex + 1;
}
```

### Search Performance Optimization
- Cache cafes in database on first search
- Check cache before hitting Geoapify API
- Only fetch if < 10 cafes in DB (MIN_RESULTS_THRESHOLD)
- Saves API costs and improves speed

### Google Maps Scraper Agent

A Puppeteer-based web scraper for extracting cafe data from Google Maps URLs and storing them in the database.

**Location:** `/lib/scraper/googleMapsScraper.ts`
**API Endpoint:** `POST /api/cafes/scrape`

#### Features
- Scrapes cafe data from Google Maps place URLs
- Extracts: name, address, location (lat/lng), phone, website, photos, hours, and ratings
- Stores data in Supabase `cafes` table
- Duplicate detection to avoid storing the same cafe twice
- Headless browser automation with anti-detection measures

#### Usage

**Via API:**
```bash
curl -X POST http://localhost:3000/api/cafes/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com/maps/place/Your+Cafe/@37.7749,-122.4194,17z/..."}'
```

**Response:**
```json
{
  "success": true,
  "message": "Cafe scraped and stored successfully",
  "cafeId": "uuid-here",
  "cafeData": {
    "name": "Cafe Name",
    "address": "123 Main St",
    "location": {"lat": 37.7749, "lng": -122.4194},
    "phone": "+1234567890",
    "website": "https://example.com",
    "photos": ["url1", "url2"],
    "hours": {"summary": "Open 7am-5pm"},
    "rating": 4.5,
    "totalReviews": 120
  },
  "duplicate": false
}
```

**Programmatic usage:**
```typescript
import { scrapeGoogleMaps, isValidGoogleMapsUrl } from '@/lib/scraper/googleMapsScraper';

const url = 'https://www.google.com/maps/place/...';
if (isValidGoogleMapsUrl(url)) {
  const cafeData = await scrapeGoogleMaps(url);
}
```

**Test script:**
```bash
# Edit scripts/test-scraper.ts with your Google Maps URL
npx ts-node scripts/test-scraper.ts
```

#### How to Get Google Maps URLs
1. Search for a cafe on [Google Maps](https://maps.google.com)
2. Click on the cafe to open its details
3. Click "Share" button
4. Copy the URL (should contain `/maps/place/`)

#### Supported URL Formats
- `https://www.google.com/maps/place/Cafe+Name/@lat,lng,...`
- `https://maps.google.com/maps/place/...`
- URLs with coordinates in `@lat,lng` or `!3d[lat]!4d[lng]` format

#### Data Mapping

| Google Maps Field | Database Column | Type |
|-------------------|----------------|------|
| Place name | `name` | text |
| Formatted address | `address` | text |
| Coordinates | `location` | geography(Point) |
| Phone number | `phone` | text |
| Website | `website` | text |
| Photos | `user_photos` | text[] |
| Opening hours | `verified_hours` | jsonb |

## Troubleshooting

### Common Issues

**Supabase Connection Errors**
- Verify `.env.local` has correct credentials
- Check Supabase project is running
- Ensure PostGIS extension is enabled
- Test with: `curl https://YOUR_PROJECT.supabase.co/rest/v1/`

**Map Not Rendering**
- Verify Mapbox token is valid
- Check browser console for errors
- Ensure internet connection for tile loading

**Stars Not Interactive**
- Verify `interactive={true}` prop passed
- Check browser console for JavaScript errors
- Ensure PNG assets exist in `/public/assets/`

**No Cafes Found**
- Check GPS permissions granted
- Verify location is within supported areas
- Check Geoapify API key is valid
- Look for API errors in server console

---

## Contact & Contribution

Contributions welcome! See README.md for how to get started.

**Tech Stack Summary**: Next.js 15 + TypeScript + Supabase + Mapbox + Tailwind CSS
**Status**: Active development (core features complete, working on social features)

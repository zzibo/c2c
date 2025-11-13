# C2C Web Application - Technical Roadmap & AI-Powered Development Plan

> **CTO's Vision**: Build a production-ready web application while mastering modern AI development tools

## Executive Summary

This roadmap transforms C2C from an iOS app to a cutting-edge web application, leveraging:
- **Next.js 15** (App Router) for modern React development
- **Firebase** for backend infrastructure
- **AI-First Development** using Claude Code, Cursor, v0, and MCP servers
- **Modern tooling** that will make you a more productive engineer

---

## Technology Stack (Modern Web Approach)

### Frontend
- **Framework**: Next.js 15 (App Router, React 19)
- **Language**: TypeScript 5.3+
- **UI Library**:
  - **Shadcn/ui** (composable components built on Radix UI)
  - **Tailwind CSS** (utility-first styling)
  - **Framer Motion** (animations)
- **State Management**:
  - Zustand (simple, modern alternative to Redux)
  - React Query / TanStack Query (server state)
- **Maps**:
  - Mapbox GL JS (better than Google Maps for web)
  - OR Google Maps JavaScript API (if preferred)

### Backend & Infrastructure
- **BaaS**: Firebase
  - **Authentication**: Firebase Auth (Google, Email, Anonymous)
  - **Database**: Firestore (NoSQL, real-time)
  - **Storage**: Firebase Storage (images)
  - **Functions**: Firebase Functions (serverless)
  - **Analytics**: Firebase Analytics
  - **Hosting**: Firebase Hosting OR Vercel

### External APIs
- **Geolocation**:
  - Google Places API (cafe data, autocomplete)
  - Mapbox Geocoding API (reverse geocoding)
- **AI/LLM**:
  - Anthropic Claude API (recommendations, natural language)
  - OpenAI GPT-4 (alternative/comparison)
  - Vercel AI SDK (stream responses, unified interface)

### Developer Tools & AI Assistants

#### 1. **Claude Code** (What you're using now!)
- **Use for**: Architecture decisions, code reviews, complex refactoring
- **Learning**: Prompt engineering, context management
- **Pro tip**: Use it to explain unfamiliar code patterns

#### 2. **Cursor IDE**
- **Use for**: Day-to-day coding with AI pair programming
- **Features**:
  - Cmd+K for inline code generation
  - Cmd+L for chat with codebase context
  - Multi-file editing with AI
- **Learning**: How to work with AI as a coding partner
- **Setup**: Install Cursor, enable Anthropic Claude as model

#### 3. **v0.dev** (Vercel's UI Generator)
- **Use for**: Rapid UI prototyping
- **Workflow**:
  1. Describe component in natural language
  2. Get React + Tailwind code
  3. Copy to your project, customize
- **Learning**: Modern React patterns, Tailwind best practices
- **When to use**: Forms, modals, complex layouts

#### 4. **MCP (Model Context Protocol) Servers**
MCP allows Claude to interact with external tools and data sources.

**Essential MCP Servers for This Project**:

- **@modelcontextprotocol/server-filesystem**
  - Read/write local files
  - Project scaffolding

- **@modelcontextprotocol/server-github**
  - Repository management
  - PR creation and review

- **@modelcontextprotocol/server-firebase**
  - Direct Firestore queries
  - Deploy functions

- **@modelcontextprotocol/server-google-maps**
  - Places API integration
  - Geocoding helpers

- **Custom MCP Server** (You'll build this!)
  - Cafe recommendation logic
  - Rating aggregation
  - Search optimization

#### 5. **GitHub Copilot / Copilot Chat**
- **Use for**: Autocomplete, boilerplate generation
- **Learning**: How AI understands code context
- **Best for**: Repetitive patterns, tests, type definitions

#### 6. **Bolt.new** (StackBlitz AI)
- **Use for**: Quick prototypes, proof-of-concepts
- **Learning**: Instant full-stack apps from prompts
- **When to use**: Testing library integrations before adding to main project

#### 7. **Supermaven** (Alternative Copilot)
- **Use for**: Faster autocomplete than Copilot
- **Learning**: Different AI code completion approach
- **Try it**: Free tier available

#### 8. **Warp Terminal** (AI Terminal)
- **Use for**: Terminal commands with AI help
- **Features**: Natural language to command, AI command search
- **Learning**: Advanced CLI usage

---

## Phase-by-Phase Development Plan

### Phase 0: Setup & Learning AI Tools (Week 1)
**Goal**: Set up development environment and understand AI tooling

#### Tasks
1. **Environment Setup**
   ```bash
   # Use Claude Code to help you:
   npx create-next-app@latest c2c-web --typescript --tailwind --app
   cd c2c-web
   npm install firebase @anthropic-ai/sdk zustand @tanstack/react-query
   npm install -D @types/google.maps
   ```

2. **Install AI Development Tools**
   - [ ] Install Cursor IDE
   - [ ] Set up Claude API key in Cursor
   - [ ] Configure Warp terminal
   - [ ] Install MCP servers via Claude Code
   - [ ] Create v0.dev account
   - [ ] Set up GitHub Copilot (if available)

3. **Learning Activities**
   - [ ] Use v0.dev to generate a sample button component
   - [ ] Use Cursor Cmd+K to generate a TypeScript interface
   - [ ] Ask Claude Code to explain Next.js App Router
   - [ ] Use Warp to learn 3 new git commands

4. **Project Structure** (Use Claude Code to generate this!)
   ```
   c2c-web/
   ├── app/
   │   ├── (auth)/          # Auth pages
   │   ├── (map)/           # Map view
   │   ├── cafes/           # Cafe details
   │   ├── api/             # API routes
   │   └── layout.tsx
   ├── components/
   │   ├── ui/              # Shadcn components
   │   ├── map/             # Map components
   │   ├── cafe/            # Cafe components
   │   └── ai/              # AI chat components
   ├── lib/
   │   ├── firebase/        # Firebase config
   │   ├── ai/              # Claude API integration
   │   ├── maps/            # Maps API wrapper
   │   └── utils/
   ├── hooks/               # Custom React hooks
   ├── types/               # TypeScript types
   └── mcp-server/          # Custom MCP server
   ```

**AI Tool Usage**:
- Use **Claude Code** to generate the entire project structure
- Use **v0.dev** to design the initial landing page
- Use **Cursor** to set up Firebase configuration

---

### Phase 1: Core Map & Discovery (Weeks 2-3)

#### Week 2: Map Integration & Basic UI

**Tasks**:
1. **Map Component** (Use v0.dev + Cursor)
   - Generate map UI with v0.dev
   - Implement with Mapbox GL using Cursor Cmd+K
   - Add user location tracking
   - Custom cafe markers

2. **Cafe Data from Google Places** (Use Claude Code)
   - Ask Claude Code to create API route
   - Set up server-side API calls (hide API keys)
   - Create TypeScript types from Places API response

3. **UI Components** (Use v0.dev heavily here!)
   - v0: "Create a modern cafe card with image, ratings, and distance"
   - v0: "Create a bottom sheet for mobile cafe details"
   - v0: "Create a search bar with autocomplete"

**AI Learning Focus**:
- **Prompt engineering**: Learn to describe UI precisely to v0
- **Context management**: Use Claude Code's file context
- **Inline generation**: Master Cursor's Cmd+K workflow

**Code Example** (Have AI generate this):
```typescript
// types/cafe.ts - Ask Claude Code to generate this
export interface Cafe {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  address: string;
  placeId: string;
  ratings: {
    coffee: number;
    vibe: number;
    infra: number;
    overall: number;
  };
  totalReviews: number;
  photos: string[];
  hours?: OpeningHours;
  distance?: number; // meters from user
}
```

#### Week 3: Search & Filtering

**Tasks**:
1. **Algolia Integration** (Better than building search yourself)
   - Use Firebase Extensions to sync Firestore to Algolia
   - Implement instant search with `react-instantsearch`
   - Ask Claude Code to explain Algolia architecture

2. **Advanced Filters** (Use Cursor for rapid development)
   - Cursor: "Generate filter component with checkboxes for ratings > 4"
   - Cursor: "Add distance slider from 0-5km"
   - Use Shadcn/ui for UI components

3. **Cafe Detail Page**
   - v0: "Create a cafe detail page with image carousel, ratings breakdown, reviews list"
   - Cursor: Implement data fetching with React Query
   - Add loading states and error boundaries

**AI Learning Focus**:
- **Multi-file editing**: Use Cursor to edit components + types + API routes simultaneously
- **Code explanation**: Ask Claude Code to explain React Query cache patterns
- **Iteration**: Use v0 to iterate on designs quickly

---

### Phase 2: Rating System & Firebase Backend (Weeks 4-5)

#### Week 4: Firestore Schema & CRUD Operations

**Tasks**:
1. **Design Firestore Schema** (Use Claude Code as architect)
   - Ask: "Design a Firestore schema for cafes, ratings, users with optimal read patterns"
   - Implement security rules
   - Set up composite indexes

2. **Rating Submission Flow**
   - v0: "Create a multi-step rating form with star ratings for 6 categories"
   - Cursor: Implement form validation with Zod
   - Add optimistic updates with React Query

3. **Real-time Updates**
   - Use Firestore's `onSnapshot` for real-time ratings
   - Implement with React Query subscriptions
   - Ask Claude Code to optimize listener patterns

**AI Learning Focus**:
- **Architecture discussions**: Use Claude Code for database design
- **Form generation**: Master v0 for complex forms
- **Debugging**: Use Cursor Chat to debug Firebase errors

**MCP Server Development** (Advanced):
```typescript
// mcp-server/cafe-ratings.ts
// Ask Claude Code to build a custom MCP server that:
// 1. Aggregates ratings in real-time
// 2. Provides search endpoints
// 3. Caches frequently accessed data

// This teaches you:
// - MCP protocol
// - Server-side optimization
// - API design
```

#### Week 5: Authentication & User Profiles

**Tasks**:
1. **Firebase Auth** (Use Cursor + Firebase docs)
   - Cursor: "Set up Firebase Auth with Google and email providers"
   - Implement session management with Next.js middleware
   - Protected routes

2. **User Profile**
   - v0: Generate profile page UI
   - Cursor: Implement profile editing
   - Add user's rating history

3. **Social Features**
   - Save favorite cafes
   - Follow other users (Firestore subcollections)
   - Activity feed

**AI Learning Focus**:
- **Security**: Ask Claude Code to review auth implementation
- **Performance**: Use Cursor to add memoization and lazy loading
- **Testing**: Use Copilot to generate unit tests

---

### Phase 3: AI Assistant Integration (Weeks 6-7)

This is where you learn cutting-edge AI development!

#### Week 6: Natural Language Cafe Search

**Tasks**:
1. **Vercel AI SDK Setup**
   ```bash
   npm install ai @anthropic-ai/sdk
   ```

2. **Chat Interface** (v0.dev shines here)
   - v0: "Create a ChatGPT-style chat interface with message bubbles"
   - Add streaming responses with Vercel AI SDK
   - Implement chat history with Firestore

3. **Claude API Integration**
   ```typescript
   // app/api/chat/route.ts
   // Use Claude Code to build this API route that:
   // 1. Takes user query: "Find quiet cafes with good WiFi"
   // 2. Converts to Firestore query
   // 3. Returns formatted recommendations
   // 4. Explains why each cafe matches

   import Anthropic from '@anthropic-ai/sdk';
   import { StreamingTextResponse, AnthropicStream } from 'ai';

   // Claude Code will help you implement function calling
   // to search your Firestore database
   ```

4. **Function Calling for Database Search**
   - Implement Claude's tool use (function calling)
   - Tools: `searchCafes`, `getCafeDetails`, `getNearbyOptions`
   - Ask Claude Code to design the tool schema

**AI Learning Focus**:
- **LLM integration**: Understand prompts, context, tokens
- **Streaming**: Learn how to stream AI responses
- **Function calling**: Master tool use for structured data
- **Prompt engineering**: Optimize system prompts for recommendations

#### Week 7: Personalization & Advanced AI

**Tasks**:
1. **User Preference Learning**
   - Track user interactions (clicks, ratings, searches)
   - Build preference profile in Firestore
   - Include preferences in Claude prompts

2. **Semantic Search** (Advanced)
   - Use OpenAI Embeddings API
   - Store review embeddings in Pinecone or Supabase Vector
   - Search by vibe: "cozy productive atmosphere"

3. **AI-Powered Features**
   - Auto-suggest review text (Claude API)
   - Photo analysis (Claude Vision API): "Does this cafe look quiet?"
   - Recommendation explanations

**AI Learning Focus**:
- **Vector databases**: Learn embeddings and semantic search
- **Multimodal AI**: Use Claude to analyze cafe photos
- **RAG patterns**: Retrieval-Augmented Generation for reviews
- **Cost optimization**: Caching, prompt compression

**Custom MCP Server for AI** (Build this yourself!):
```typescript
// mcp-server/recommendation-engine.ts
// This MCP server will:
// 1. Provide cafe recommendations to Claude
// 2. Access user preferences
// 3. Calculate semantic similarity
// 4. Expose tools for Claude Code to use in your dev workflow!

// Learning outcomes:
// - Understanding MCP protocol
// - Building reusable AI tools
// - Server-side AI optimization
```

---

### Phase 4: Polish & Advanced Features (Weeks 8-9)

#### Week 8: Performance & UX

**Tasks**:
1. **Performance Optimization** (Use Cursor + Claude Code)
   - Cursor: Implement image optimization with Next.js Image
   - Claude Code: Review bundle size, suggest optimizations
   - Add infinite scroll for cafe lists (React Query)
   - Implement service worker for offline support

2. **Mobile Responsiveness**
   - v0: Regenerate components with mobile-first design
   - Add PWA support (Next.js PWA plugin)
   - Touch gestures for map (Framer Motion)

3. **Accessibility**
   - Ask Claude Code to audit for WCAG compliance
   - Add keyboard navigation
   - Screen reader support

**AI Learning Focus**:
- **Code review**: Use Claude Code as senior engineer reviewer
- **Performance profiling**: Learn Next.js performance tools
- **Automated testing**: Use Copilot to generate Playwright tests

#### Week 9: Analytics & Launch Prep

**Tasks**:
1. **Analytics Setup**
   - Firebase Analytics
   - PostHog for product analytics
   - Set up funnels: search → view → rate

2. **Error Monitoring**
   - Sentry integration
   - Ask Claude Code to implement error boundaries

3. **SEO & Metadata**
   - Dynamic meta tags for cafes
   - Sitemap generation
   - Structured data (JSON-LD for cafes)

4. **Admin Dashboard** (Build with AI!)
   - v0: "Create an admin dashboard with charts for ratings, users, cafes"
   - Implement with Recharts
   - Add moderation tools

**AI Learning Focus**:
- **Production readiness**: Use Claude Code to create deployment checklist
- **Monitoring**: Learn observability with AI help
- **Documentation**: Have Claude Code generate API docs

---

## AI Development Workflows

### Daily Workflow
```
Morning:
1. Review GitHub issues → Ask Claude Code to prioritize
2. Use Cursor to start coding (Cmd+K for each function)
3. Generate UI with v0.dev
4. Use Warp terminal for git operations

Afternoon:
5. Ask Claude Code to review your morning's code
6. Use Copilot for tests
7. Deploy to Vercel (automated)
8. Check Firebase Console

Evening:
9. Update documentation (Claude Code generates it)
10. Plan tomorrow with Claude Code
```

### AI Tool Decision Matrix

| Task | Best Tool | Why |
|------|-----------|-----|
| "How should I architect this?" | Claude Code | Deep reasoning, architectural thinking |
| "Generate this component" | v0.dev | Fastest UI generation |
| "Implement this function" | Cursor (Cmd+K) | Inline, context-aware |
| "Write tests" | Copilot | Great at patterns |
| "Debug Firebase error" | Cursor Chat | Can read error logs, suggest fixes |
| "Design database schema" | Claude Code | Best at data modeling |
| "Git command help" | Warp | Natural language to CLI |
| "Create API endpoint" | Cursor | Multi-file awareness |

---

## Learning Milestones

Track your AI tool mastery:

### Week 1-2: Beginner
- [ ] Can use v0.dev to generate components
- [ ] Can use Cursor Cmd+K for simple functions
- [ ] Ask Claude Code questions effectively

### Week 3-5: Intermediate
- [ ] Use Cursor for multi-file edits
- [ ] Iterate on v0 designs with feedback
- [ ] Use Claude Code for architectural decisions
- [ ] Set up basic MCP servers

### Week 6-7: Advanced
- [ ] Integrate Claude API with function calling
- [ ] Build custom MCP server
- [ ] Use AI for code reviews
- [ ] Optimize prompts for better results

### Week 8-9: Expert
- [ ] Use AI for performance optimization
- [ ] Automate testing with AI
- [ ] Generate documentation automatically
- [ ] Build AI-powered features

---

## Key Architectural Decisions

### 1. Next.js App Router vs Pages Router
**Decision**: Use App Router (Next.js 13+)
**Why**:
- Server Components reduce client bundle
- Built-in streaming
- Better for SEO
- React 19 features

**Ask Claude Code**: "Explain the benefits of Server Components for this app"

### 2. Mapbox vs Google Maps
**Decision**: Mapbox GL JS
**Why**:
- Better pricing for web
- More customization
- Vector tiles (faster)
- Better mobile performance

**Alternative**: Google Maps if you need Places API integration

### 3. Firestore vs PostgreSQL (Supabase)
**Decision**: Firestore
**Why**:
- Real-time out of the box
- Offline support
- Simpler scaling
- Better Firebase ecosystem integration

**Ask Claude Code**: "Compare Firestore and Supabase for real-time cafe ratings"

### 4. Client-side vs Server-side AI
**Decision**: Hybrid approach
- **Server-side** (Next.js API routes): Claude API, sensitive operations
- **Client-side**: UI interactions, optimistic updates

### 5. State Management
**Decision**:
- **Zustand** for client state (user preferences, UI state)
- **React Query** for server state (cafes, ratings)
- **Firestore listeners** for real-time data

**Ask Claude Code**: "When to use Zustand vs React Query in this app?"

---

## Advanced: Building Your Custom MCP Server

This is your capstone project - building a tool that other developers (and AI) can use!

### MCP Server: Cafe Recommendation Engine

**Purpose**: Expose cafe data and recommendation logic to Claude Code and other MCP clients

**File**: `mcp-server/src/index.ts`

```typescript
// Have Claude Code help you build this!
// It should expose these tools:

// 1. recommend_cafes
//    Input: { query: string, user_preferences: object, location: LatLng }
//    Output: Ranked list of cafes with explanations

// 2. search_cafes
//    Input: { filters: object, bounds: LatLngBounds }
//    Output: Filtered cafe list

// 3. get_cafe_analytics
//    Input: { cafe_id: string }
//    Output: Rating trends, peak times, user demographics

// 4. optimize_route
//    Input: { cafe_ids: string[] }
//    Output: Optimal visiting order (TSP algorithm)
```

**Learning Outcomes**:
- MCP protocol implementation
- TypeScript server development
- API design principles
- Testing strategies
- Publishing to npm

**Use Case**: Other developers can use your MCP server to:
- Build apps on top of C2C data
- Analyze cafe trends
- Create recommendation systems

---

## Production Deployment

### Hosting Strategy
1. **Frontend**: Vercel (seamless Next.js integration)
2. **Backend**: Firebase Functions (serverless)
3. **Database**: Firestore (managed)
4. **CDN**: Vercel Edge Network
5. **Images**: Firebase Storage + Imgix (optimization)

### CI/CD Pipeline (Set up with Claude Code's help)
```yaml
# .github/workflows/deploy.yml
# Ask Claude Code to generate this:
# - Run tests on PR
# - Deploy preview on Vercel
# - Deploy to production on main merge
# - Run Lighthouse CI
# - Check bundle size
```

### Monitoring
- **Firebase Performance Monitoring**
- **Sentry** for error tracking
- **LogRocket** for session replay (debug user issues)
- **Vercel Analytics** for web vitals

---

## Cost Estimation

| Service | Free Tier | Estimated Cost (1000 users) |
|---------|-----------|------------------------------|
| Firebase (Firestore) | 1GB, 50K reads/day | $25/month |
| Firebase Storage | 5GB | $10/month |
| Vercel Hosting | 100GB bandwidth | $0 (hobby) or $20 (pro) |
| Mapbox | 50K loads/month | $0-50 |
| Google Places API | $200 credit/month | $50 |
| Claude API | Pay-as-you-go | $100 (50K messages) |
| Algolia Search | 10K requests | $0 or $1/1K after |
| **Total** | | **~$200-300/month** |

**Cost Optimization Tips** (Ask Claude Code for more):
- Cache Places API responses in Firestore
- Use Claude caching for system prompts
- Optimize images with Next.js Image
- Implement rate limiting

---

## Success Metrics & Analytics

### User Engagement
- DAU/MAU ratio
- Average session duration
- Cafes viewed per session
- Search → view → rate conversion

### AI Features
- AI chat usage rate
- Query success rate (user clicks recommended cafe)
- Average conversation length
- Natural language vs filter usage

### Content Quality
- Ratings per cafe
- Review helpfulness votes
- Photo upload rate
- User retention (7-day, 30-day)

**Set up Dashboards**: Use PostHog or Mixpanel, ask Claude Code to help with event tracking

---

## Next Steps: Week 1 Action Plan

### Day 1: Environment Setup
- [ ] Create Next.js project with Claude Code
- [ ] Install Cursor IDE, connect to Anthropic
- [ ] Set up Firebase project
- [ ] Install Warp terminal
- [ ] Create v0.dev account

### Day 2: Project Structure
- [ ] Use Claude Code to generate folder structure
- [ ] Set up Shadcn/ui
- [ ] Configure TypeScript strict mode
- [ ] Set up ESLint + Prettier (ask Claude Code for config)

### Day 3: First Components
- [ ] Use v0 to generate navbar
- [ ] Use v0 to generate hero section
- [ ] Cursor: Implement layout.tsx
- [ ] Get basic app running on localhost

### Day 4: Map Integration
- [ ] Add Mapbox GL JS
- [ ] Cursor: Create Map component
- [ ] Implement user location
- [ ] Test on mobile (Chrome DevTools)

### Day 5: Firebase + TypeScript
- [ ] Set up Firebase SDK
- [ ] Claude Code: Generate TypeScript types for Firestore
- [ ] Create first Firestore collection (cafes)
- [ ] Test CRUD operations

### Weekend: Learning & Exploration
- [ ] Watch Next.js 15 tutorial
- [ ] Read Vercel AI SDK docs
- [ ] Experiment with Claude API playground
- [ ] Explore Firebase Console
- [ ] Build a mini project with v0.dev

---

## Resources & Learning Materials

### Essential Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [Firebase Docs](https://firebase.google.com/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Anthropic Claude API](https://docs.anthropic.com)
- [MCP Documentation](https://modelcontextprotocol.io)
- [Shadcn/ui](https://ui.shadcn.com)

### AI Tool Documentation
- [Cursor Documentation](https://cursor.sh/docs)
- [v0.dev Guide](https://v0.dev/docs)
- [MCP Servers](https://github.com/modelcontextprotocol/servers)

### Video Tutorials (Watch These!)
- "Next.js 15 App Router Crash Course" - Traversy Media
- "Building AI Apps with Vercel AI SDK" - Fireship
- "Firebase Firestore Tutorial" - Academind
- "Cursor AI Tutorial" - Ben Awad

### Communities
- Next.js Discord
- Firebase Discord
- r/webdev
- Cursor Community Forum

---

## Pro Tips from a CTO Perspective

### 1. Start with User Value, Not Tech
Don't build AI features because they're cool. Build them because they solve real problems:
- **Good**: AI that finds cafes matching vague descriptions
- **Bad**: AI that just rephrases reviews

### 2. Mobile-First Always
60%+ of traffic will be mobile. Test on real devices early.

### 3. Data Quality > Features
A cafe with 10 detailed ratings is better than 100 cafes with no data. Focus on user contribution UX.

### 4. AI is a Tool, Not Magic
- AI will make mistakes - have fallbacks
- Always show confidence scores
- Let users correct AI recommendations

### 5. Measure Everything
Instrument your app from day 1. You can't improve what you don't measure.

### 6. Use AI to Learn Faster
- Stuck? Ask Claude Code to explain
- Don't copy-paste blindly - understand the code
- Use AI to generate tests, then read them to learn

### 7. Build in Public
- Tweet your progress
- Write dev logs
- Share on Reddit/HN
- You'll learn more and get feedback

### 8. Security from Day 1
- Never expose API keys client-side
- Use Firebase Security Rules
- Validate all inputs
- Rate limit AI endpoints

---

## The Learning Journey

### What You'll Master

**Technical Skills**:
- Modern React (Server Components, Suspense)
- TypeScript (advanced types)
- Firebase (Firestore, Auth, Functions)
- AI Integration (Claude API, embeddings)
- API Design
- Performance optimization
- Mobile-first development

**AI Development Skills**:
- Prompt engineering
- Function calling / tool use
- Streaming responses
- Vector search
- MCP server development
- AI-assisted debugging
- Code generation workflows

**Soft Skills**:
- Product thinking
- User-centric design
- Performance budgeting
- Monitoring & observability
- Technical writing (docs)

### Career Impact
By the end of this project, you'll be able to:
- Build production-ready full-stack apps
- Integrate AI into real products
- Use AI tools like a senior engineer
- Contribute to open-source (your MCP server!)
- Interview confidently for senior roles

---

## Conclusion: Why This Approach?

This isn't just an app - it's a **learning accelerator**:

1. **Real-world complexity**: Maps, real-time data, AI - you'll face production challenges
2. **AI-first workflow**: You'll learn to be 10x more productive
3. **Modern stack**: Next.js + Firebase is industry standard
4. **Portfolio piece**: Shows full-stack + AI skills
5. **Open-source opportunity**: Your MCP server helps others

**The CTO Mindset**:
- Build to learn, learn to build
- Use AI to move faster, not to avoid understanding
- Focus on user value, not tech hype
- Measure, iterate, improve
- Share your knowledge

Let's build something amazing! 🚀

---

## Quick Reference: AI Tool Cheat Sheet

```
NEED TO...                          USE...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Understand architecture             Claude Code (chat)
Generate UI component                v0.dev
Implement function inline            Cursor (Cmd+K)
Debug error                          Cursor Chat
Write tests                          GitHub Copilot
Design database                      Claude Code
Multi-file refactor                  Cursor
Learn new API                        Claude Code (explain)
Git commands                         Warp Terminal
Review PR                            Claude Code
Generate docs                        Claude Code
Autocomplete code                    Copilot / Supermaven
Create API endpoint                  Cursor + Claude Code
Optimize performance                 Claude Code (review)
Build prototype                      Bolt.new
```

---

**Ready to start?** Ask Claude Code: "Help me set up the Next.js project with all dependencies for Phase 0"

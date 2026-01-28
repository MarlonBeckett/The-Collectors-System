# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Collectors System is a Next.js 15 full-stack application for managing vehicle collections with AI-powered assistance. Users can track motorcycles, cars, boats, and other vehicles; organize them into shared collections; and interact with an AI chatbot (Google Gemini 2.5-Flash) that provides vehicle insights and executes actions.

## Quick Start Commands

```bash
npm install          # Install dependencies
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build for production
npm start            # Run production server
npm run lint         # Run ESLint
```

## Environment Setup

The app requires three environment variables in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `GEMINI_API_KEY` - Google Gemini API key

These are validated at runtime with helpful error messages if missing. The app uses Supabase for authentication (OAuth), database (PostgreSQL), and storage (vehicle photos).

## Architecture Overview

### Technology Stack

- **Frontend**: Next.js 15 with React 19 Server Components + Client Components
- **Styling**: Tailwind CSS 4 with OKLCH color space + Oxanium/Source Code Pro fonts
- **Database**: Supabase PostgreSQL with Row Level Security
- **Auth**: Supabase OAuth (cookie-based sessions via SSR)
- **AI**: Google Gemini 2.5-Flash with Google Search grounding
- **Data**: PapaParse for CSV import/export, date-fns for dates

### Project Structure

```
src/
├── app/              # Next.js App Router with pages and API routes
│   ├── api/          # Backend: chat, auth, collections, cron jobs
│   ├── chat/         # Chat interface page
│   ├── vehicles/     # Vehicle CRUD operations
│   ├── import/       # CSV import and bulk photo upload
│   ├── login/        # Authentication pages
│   └── [more pages]  # search, settings, bikes, purchases, etc.
├── components/       # Reusable React components organized by feature
├── lib/
│   ├── supabase/     # Supabase client initialization and middleware
│   ├── collections.ts # Collection management helpers
│   ├── exportUtils.ts # CSV export functionality
│   └── [utilities]   # Date parsing, status parsing, etc.
└── types/database.ts # Auto-generated TypeScript types from Supabase
```

### Data Model Highlights

**Core Tables:**
- `motorcycles` - Vehicles with fields: year, make, model, VIN, plate, mileage, status, estimated value, notes
- `collections` - Shared vehicle collections with unique join codes
- `collection_members` - User membership with roles (owner/editor)
- `photos` - Vehicle photos stored on Supabase Storage
- `chat_sessions` & `chat_messages` - Conversation history with action/choice metadata
- `vehicle_facts` - "Smart memory" of learned preferences extracted from conversations
- `mileage_history`, `value_history` - Historical tracking
- `vehicle_purchases` - Parts/service history

**RLS (Row Level Security):** Implemented at the database level. Collections control access to motorcycles; users see only their data by default.

### Key Data Flows

**Chat Feature:**
1. Client sends message to `/api/chat`
2. Server retrieves user's vehicles and chat history
3. Sends context + message to Google Gemini API with Search enabled
4. Parses response for special syntax:
   - `[CHOICE: question | option1 | option2 | option3]` → Interactive buttons
   - `[ACTION: actionType : vehicleRef : params]` → Vehicle action execution
5. Extracts vehicle preferences into `vehicle_facts` table
6. Client displays response; actions route to `/api/chat/action`

**Collections & Access Control:**
- Owner generates join code → Members join via code → RLS policies enforce access
- Collections own vehicles; members see/edit based on their role
- `get_user_collections` RPC returns all collections a user can access

**Authentication Middleware:**
- Routes protected by `/src/lib/supabase/middleware.ts`
- Redirects unauthenticated users to `/login`
- OAuth callback at `/api/auth/callback` handles session creation
- Sessions stored in HTTP-only cookies (secure, can't be accessed by client JS)

### Rendering Strategy

- **Server Components (default)**: Pages use server-side rendering for data fetching and initial HTML
- **Client Components**: Interactive UI wrapped in `'use client'` boundaries
- **Force Dynamic**: Pages needing real-time data use `export const dynamic = 'force-dynamic'`
- **Static Exports Disabled**: Uses SSR/dynamic rendering, not static site generation

## Common Development Tasks

### Running the App
```bash
npm run dev
# Visit http://localhost:3000
# Log in with a test user via OAuth
```

### Adding a New Page
1. Create file in `src/app/[route]/page.tsx`
2. Use Server Component by default for data fetching
3. Wrap interactive parts with `'use client'` if needed
4. Use Supabase client from `@/lib/supabase/server` (server) or `@/lib/supabase/client` (browser)
5. Middleware automatically redirects if not authenticated

### Adding an API Route
1. Create file in `src/app/api/[route]/route.ts`
2. Import `{ createClient } from '@/lib/supabase/server'` for authenticated requests
3. Check `request.auth.user` or call Supabase methods
4. Use RLS policies to enforce access control at the database level
5. Return JSON responses with appropriate status codes

### Working with Supabase
- **Server-side**: `import { createClient } from '@/lib/supabase/server'`
- **Client-side**: `import { createClient } from '@/lib/supabase/client'`
- Types auto-generated in `src/types/database.ts` based on schema
- RLS policies enforce security; trust the database to reject unauthorized queries

### Styling
- Use Tailwind CSS utility classes
- Dark mode via `dark:` prefix (auto detects system preference)
- Colors use OKLCH space (perceptually uniform)
- No border radius by design (sharp corners)
- Typography plugin available for markdown rendering

### AI Chat Integration
- Google Gemini 2.5-Flash used for conversations
- Search grounding enabled for real-world product research
- Parse special syntax from AI responses: `[CHOICE: ...]` and `[ACTION: ...]`
- Extract vehicle preferences for learning
- Chat history stored in database for context

## Important Patterns & Conventions

### Authentication & Authorization
- Always use server-side Supabase client for sensitive operations
- Browser client uses Supabase anon key (limited permissions by RLS)
- Check `user` object from Supabase session before accessing user data
- RLS policies at the database level are the primary security mechanism

### Type Safety
- Strict TypeScript enabled
- Use auto-generated database types from `src/types/database.ts`
- Generic types for database operations ensure correctness
- No `any` types unless absolutely necessary

### API Route Pattern
```typescript
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use supabase client for database operations
  // RLS policies enforce access control
}
```

### Component Pattern
```typescript
'use client'; // Only if interactive

import { createClient } from '@/lib/supabase/client';

export function MyComponent() {
  const supabase = createClient();
  // Use hooks for data fetching and state
}
```

## Deployment

- **Host**: Vercel (environment setup indicates this)
- **Build**: `npm run build` generates optimized Next.js build
- **Environment Validation**: Runtime checks for missing env vars with helpful error messages
- **Image Optimization**: Configured for Supabase Storage remote images
- **PWA Ready**: Manifest and icons configured; installable on mobile

## Testing Strategy

No automated tests configured. Focus on manual testing and leveraging TypeScript for type safety.

## Performance Considerations

- Image optimization via Next.js Image component (set up for Supabase)
- Server-side rendering reduces client-side JavaScript
- Database queries in API routes (server-side) to avoid exposing sensitive logic
- CSV export handled server-side for large datasets
- Lazy-loaded components where appropriate

## Chat System Improvements (Latest)

The chat system has been significantly enhanced with:
- **Question Minimization**: AI uses vehicle context to make educated guesses instead of asking "what type?"
- **Automatic Product Search**: Products recommended automatically with working links and current pricing
- **Inline Product Format**: `[Product Name](url) - $XX.XX` for clear, natural recommendations
- **Smart Actions**: "Log purchase" actions only appear after user explicitly confirms buying something
- **Structured Product Metadata**: `[PRODUCT: name | url | price | category]` syntax for tracking
- **Better Mobile UX**: Product recommendations display cleanly on mobile with inline pricing

See `CHAT_UX_IMPROVEMENTS.md` for detailed documentation on the new flow and examples.

## Known Active Work

Current development on `dev/work-in-progress` branch includes:
- CSV import/export refinements
- Mobile responsiveness improvements
- iOS compatibility fixes
- Settings page enhancements

Recent fixes address Vercel/Supabase environment variable validation, dynamic rendering for real-time data, and comprehensive chat UX improvements.

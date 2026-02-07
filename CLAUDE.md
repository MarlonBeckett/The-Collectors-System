# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint with Next.js config
```

## Current MVP Features

- Vehicle database (add/edit/delete with make, model, year, VIN, plate, nickname, notes, status)
- Multi-vehicle-type support (motorcycle, car, boat, trailer, other)
- Photo upload & gallery with ordering, bulk import
- Mileage tracking with historical entries
- Tab/registration expiration tracking with dashboard warnings
- Purchase price & date tracking
- Collections system with owner/editor/viewer roles and invite codes
- CSV import/export for bulk data migration
- Quick stats dashboard (active count, maintenance alerts, expiration warnings)
- Vehicle search
- Supabase auth with profiles
- Cron job for expiration checking

## Tech Stack

- **Next.js 15.3** with App Router and React 19
- **TypeScript** (strict mode, `@/*` path alias maps to `./src/*`)
- **Supabase** for PostgreSQL database with RLS and authentication
- **Tailwind CSS 4** with OKLCH color system

## Architecture

### Data Flow
```
Client Components → API Routes → Supabase (RLS enforced)
```

### Collection-Based Data Isolation
All vehicles belong to a collection. RLS policies filter data by `collection_id`. Users access collections through membership roles: owner, editor, viewer.

### Supabase Client Usage
- **Server components/API routes**: Use `createClient()` from `@/lib/supabase/server` (creates fresh client per request)
- **Client components**: Use `createClient()` from `@/lib/supabase/client` (browser singleton)
- **Middleware**: `src/lib/supabase/middleware.ts` handles session refresh and auth redirects

### Key Directories
- `src/app/api/` - Server API routes (auth, collections, cron)
- `src/lib/supabase/` - Database clients (server.ts for server components, client.ts for browser)
- `src/components/` - React components organized by feature (auth, layout, vehicles, settings)
- `src/types/database.ts` - Supabase schema types (includes `Database` type for typed queries)

### Database Tables (all RLS-enabled)
- `motorcycles` - All vehicle records (despite the name, supports motorcycle, car, boat, trailer, other via `vehicle_type` column)
- `collections` / `collection_members` / `collection_invites` - Collection ownership and sharing
- `photos` - Vehicle photos stored in Supabase Storage
- `mileage_history` / `value_history` - Historical tracking

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## ESLint Config

Unused variables are warnings (not errors). Underscore-prefixed args are ignored (`argsIgnorePattern: "^_"`).

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint with Next.js config
```

## Tech Stack

- **Next.js 15.3** with App Router and React 19
- **TypeScript** (strict mode, `@/*` path alias maps to `./src/*`)
- **Supabase** for PostgreSQL database with RLS and authentication
- **Google Gemini 2.5 Flash** (`@google/genai`) for AI chat
- **Tavily Search API** (`@tavily/core`) for product research
- **Tailwind CSS 4** with OKLCH color system

## Architecture

### Data Flow
```
Client Components → API Routes → Supabase (RLS enforced) → External APIs (Gemini, Tavily)
```

### Collection-Based Data Isolation
All vehicles belong to a collection. RLS policies filter data by `collection_id`. Users access collections through membership roles: owner, editor, viewer.

### Key Directories
- `src/app/api/` - Server API routes (chat, auth, collections, cron)
- `src/lib/chat/` - AI orchestration (intent classification, research, synthesis)
- `src/lib/supabase/` - Database clients (server.ts for server components, client.ts for browser)
- `src/components/` - React components organized by feature (auth, layout, vehicles, chat, settings)
- `src/types/database.ts` - Supabase schema types

### Chat/Research System
The chat system in `src/lib/chat/` classifies user intent, then either:
1. Responds directly for simple questions
2. Triggers multi-query Tavily search → Gemini synthesis for product research with fitment verification

### Database Tables (all RLS-enabled)
- `motorcycles` - Vehicle records (supports motorcycle, car, boat, trailer, other)
- `collections` / `collection_members` / `collection_invites` - Collection ownership and sharing
- `photos` - Vehicle photos stored in Supabase Storage
- `chat_sessions` / `chat_messages` - Chat history with metadata
- `mileage_history` / `value_history` - Historical tracking

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
GEMINI_API_KEY
TAVILY_API_KEY  # Optional - enables product research
```

## ESLint Config

Unused variables are warnings (not errors). Underscore-prefixed args are ignored (`argsIgnorePattern: "^_"`).

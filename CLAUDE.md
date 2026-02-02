# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application for monitoring Solana validators and their software versions. The app displays validator information from multiple sources and provides filtering, sorting, and key conversion utilities.

## Development Commands

```bash
# Start development server (http://localhost:3000)
npm run dev

# Build production version
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Architecture

### Data Flow

1. **Validator Data Source**: `data/validators.json` is automatically updated hourly via GitHub Actions (`.github/workflows/update-validators.yml`), which fetches data from Solana mainnet using `solana -um validators --output json-compact`.

2. **Data Enrichment**: The app enriches validator data from two external APIs:
   - **Stakewiz API** (`https://api.stakewiz.com/validators`) - provides validator names
   - **SFDP API** (`https://api.solana.org/api/community/v1/sfdp_participants`) - provides SFDP participation status

3. **Enrichment Pattern**: Both `src/app/page.tsx` (server component) and `src/app/api/validators/route.ts` (API route) implement the same enrichment logic:
   - Load validators from `data/validators.json`
   - Fetch Stakewiz data and create a map by `vote_identity`
   - Fetch SFDP data and create a map by `mainnetBetaPubkey`
   - Merge data into validators using identity/vote account lookups

### Component Structure

- `src/app/page.tsx` - Main page (server component) that fetches and enriches data
- `src/app/convert/page.tsx` - Key converter utility for identity ↔ vote account conversion
- `src/app/api/validators/route.ts` - API endpoint that mirrors the main page's data enrichment
- `src/components/ValidatorTable.tsx` - Client component with filtering, sorting, and URL state management
- `src/components/ValidatorTableRow.tsx` - Individual validator row rendering
- `src/components/ValidatorTableHeader.tsx` - Table header with sort controls
- `src/components/CopyNotification.tsx` - Toast notification for copy operations

### Type System

`src/types/validator.ts` defines the core `Validator` type:
```typescript
{
  voteAccountPubkey: string;
  identityPubkey: string;
  activatedStake: number;
  version: string;
  delinquent: boolean;
  name: string;           // from Stakewiz
  sfdp: boolean;          // from SFDP API
  sfdpState: string | null; // from SFDP API
}
```

### Key Features

**URL State Management**: Filter and sort state is persisted to URL query parameters in `ValidatorTable.tsx` using `URLSearchParams` and `window.history.replaceState()`. This allows sharing filtered views.

**Version Filtering**: Versions are parsed as semantic versions and sorted in descending order. The filter UI splits versions into two columns for better UX.

**Key Converter** (`/convert`): Detects whether input keys are identity or vote accounts and converts them to the opposite type by looking up the validator dataset. Handles mixed input intelligently by determining the majority type.

## Stack

- **Framework**: Next.js 15 (App Router)
- **React**: 19.2.1
- **Styling**: Tailwind CSS 4
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **TypeScript**: 5

## Important Notes

- Path alias `@/*` maps to `./src/*`
- The app uses both server and client components strategically (server for data fetching, client for interactivity)
- SFDP stake calculations only count "Approved" state validators
- Validator data file is auto-generated - do not manually edit `data/validators.json`

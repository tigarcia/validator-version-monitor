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

# Run unit tests (vitest)
npm test
```

## Architecture

### Data Flow

1. **Validator Data Source**: `data/*.json` files are automatically updated hourly via GitHub Actions (`.github/workflows/update-validators.yml`) using the Solana CLI. Per network: `validators.json`/`gossip.json` (mainnet, `-um`), `testnet-validators.json`/`testnet-gossip.json` (`-ut`), `devnet-validators.json`/`devnet-gossip.json` (`-ud`).

2. **Data Enrichment**: The app enriches validator data from external APIs, gated by network:
   - **Stakewiz API** (`https://api.stakewiz.com/validators`) - provides validator names (mainnet only)
   - **SFDP API** (`https://api.solana.org/api/community/v1/sfdp_participants`) - provides SFDP participation status (mainnet via `mainnetBetaPubkey`, testnet via `testnetPubkey`; also supplies names on testnet)
   - **validators.app API** (`https://www.validators.app/api/v1/validators/{network}.json`) - provides infrastructure info (ASN, data center, software client) for mainnet and testnet

3. **Enrichment Pattern**: Enrichment logic lives in the shared `src/lib/validatorData.ts` module, used by both `src/app/page.tsx` (server component) and `src/app/api/validators/route.ts` (API route). It is network-aware, driven by the per-network config in `src/lib/network.ts`:
   - **mainnet**: Stakewiz (names) + SFDP (participation) + validators.app (infrastructure)
   - **testnet**: SFDP only, keyed by `testnetPubkey` (also supplies names) + validators.app (infrastructure)
   - **devnet**: raw data only - no external enrichment, names default to "unknown"

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
  name: string;           // from Stakewiz (mainnet) or SFDP (testnet)
  sfdp: boolean;          // from SFDP API
  sfdpState: string | null; // from SFDP API
  autonomousSystemNumber: number | null; // from validators.app
  dataCenterKey: string | null;          // from validators.app
  softwareClient: string | null;         // from validators.app
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
- Validator data files are auto-generated - do not manually edit any of the six `data/*.json` files (`validators.json`, `gossip.json`, `testnet-validators.json`, `testnet-gossip.json`, `devnet-validators.json`, `devnet-gossip.json`)

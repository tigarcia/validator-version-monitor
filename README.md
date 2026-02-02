# Solana Validator Version Monitor

A Next.js web application for monitoring Solana validators, their software versions, stake distribution, and SFDP participation status.

## Features

- **Real-time Validator Data**: Displays comprehensive information about Solana mainnet validators
- **Multi-source Data Enrichment**: Combines data from:
  - Solana RPC (validator info, versions, stake)
  - [Stakewiz API](https://stakewiz.com) (validator names)
  - [Solana Foundation Delegation Program (SFDP)](https://solana.org/delegation-program) API (participation status)
- **Advanced Filtering**:
  - Filter by software version with stake percentage breakdown
  - Filter by SFDP participation status
  - URL-based state management for shareable filtered views
- **Sortable Columns**: Sort by stake, version, name, or any other field
- **Key Converter Tool**: Convert between identity and vote account public keys
- **Automatic Updates**: GitHub Actions workflow updates validator data hourly

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Build

Build for production:

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main validator table page
│   ├── convert/page.tsx            # Key converter utility
│   ├── api/validators/route.ts     # API endpoint for validator data
│   └── layout.tsx                  # Root layout
├── components/
│   ├── ValidatorTable.tsx          # Main table with filtering/sorting
│   ├── ValidatorTableRow.tsx       # Individual validator row
│   ├── ValidatorTableHeader.tsx    # Table header with sort controls
│   └── CopyNotification.tsx        # Toast notification component
├── types/
│   └── validator.ts                # TypeScript type definitions
└── utils/
    └── copyToClipboard.ts          # Clipboard utility

data/
└── validators.json                 # Auto-generated validator data
```

## How It Works

### Data Pipeline

1. **Automated Collection**: A GitHub Actions workflow (`.github/workflows/update-validators.yml`) runs hourly to:
   - Install Solana CLI
   - Execute `solana -um validators --output json-compact`
   - Commit updated `data/validators.json` to the repository

2. **Data Enrichment**: When the app loads, it:
   - Reads `data/validators.json`
   - Fetches validator names from Stakewiz API
   - Fetches SFDP participation data from Solana Foundation API
   - Merges all data sources into a unified view

3. **Client-side Features**: The `ValidatorTable` component provides:
   - Real-time filtering and sorting
   - URL state persistence for sharing views
   - Stake percentage calculations
   - Copy-to-clipboard functionality

### Key Converter

The `/convert` page allows you to:
- Paste a list of identity OR vote account public keys
- Automatically detect the key type
- Convert all keys to the opposite type
- Copy the converted keys

Perfect for working with validator lists that need different key formats.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **React**: 19.2.1
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Animations**: Framer Motion
- **Icons**: Lucide React

## API Endpoints

### `GET /api/validators`

Returns enriched validator data with names and SFDP status.

**Response**: Array of validator objects with:
- `voteAccountPubkey`: Vote account public key
- `identityPubkey`: Identity public key
- `activatedStake`: Stake amount in lamports
- `version`: Solana software version
- `delinquent`: Whether validator is delinquent
- `name`: Validator name (from Stakewiz)
- `sfdp`: SFDP participation status
- `sfdpState`: SFDP state (e.g., "Approved")

## Contributing

This is a monitoring tool for the Solana ecosystem. Contributions welcome!

## License

MIT

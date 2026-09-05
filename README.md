# nptel-sync

CLI tool to sync Swayam/NPTEL course transcripts and YouTube URLs into NotebookLM.

## Setup

```bash
npm install
npx playwright install chromium
```

## Usage

### Interactive Mode (Recommended)
```bash
npm run dev
```

### Generic Commands

| Command | Description |
|---|---|
| `npm run dev -- login` | Open browser for one-time login to Swayam and NotebookLM |
| `npm run dev -- scan` | Scrape enrolled courses, weeks, and lectures from Swayam |
| `npm run dev -- sync-local` | Extract missing lecture transcripts / YouTube URLs locally |
| `npm run dev -- sync-notebooklm` | Push synced transcripts / URLs to NotebookLM |
| `npm run dev -- status` | Check sync status across courses and weeks |
| `npm run dev -- set-mode -c <course> <transcript|url> [-n <title>]` | Configure course sync mode and NotebookLM title |

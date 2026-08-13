# nptel-sync

> A local CLI automation tool that syncs your Swayam/NPTEL course transcripts into NotebookLM.

---

## How it works

```
Swayam (courses, weeks, lectures)
        ↓ scrape
Local state (data/state.json)
        ↓ orchestrate
YouTube (transcript extraction)
        ↓ save locally
data/transcripts/<course>/<week>/<lecture>.txt
        ↓ push
NotebookLM (correct notebook → paste source → apply week label)
```

Each **course** maps to a **pre-existing NotebookLM notebook**.  
Each **week** becomes a **label** applied to its sources.  
Each **lecture** becomes one **source** (transcript text or YouTube URL).

---

## Setup

### 1. Prerequisites

- Node.js 20+
- Internet access

### 2. Install

```bash
npm install
npx playwright install chromium   # downloads project-local browser
```

### 3. Init

```bash
npx tsx src/cli/index.ts init
```

Creates `data/`, `data/transcripts/`, `data/logs/`, `.browser-profile/`.

### 4. Login (once)

```bash
npx tsx src/cli/index.ts login
```

Opens a managed Chromium browser. Log in to:
- **Swayam** (via Google SSO)
- **NotebookLM** (Google account)

Press **Enter** in the terminal when done. The session is saved in `.browser-profile/` and reused on every future run.

---

## Commands

| Command | Description |
|---|---|
| `init` | Create local folders and empty state |
| `login` | One-time manual login via managed browser |
| `scan` | Scrape Swayam courses, weeks, and lectures |
| `status` | Print sync status for all courses |
| `sync` | Push lectures into NotebookLM |

### Examples

```bash
# See all courses and their sync state
npx tsx src/cli/index.ts status

# Filter to course 2, week 3
npx tsx src/cli/index.ts status --course=2 --week=3

# Sync all lectures in week 1 of course 1 using transcript method
npx tsx src/cli/index.ts sync --course=1 --week=1 --lecture=all --method=transcript

# Sync just lecture 2 of week 3 of course 1 using URL method
npx tsx src/cli/index.ts sync --course=1 --week=3 --lecture=2 --method=url

# Sync all weeks of course 1, all lectures, transcript method
npx tsx src/cli/index.ts sync --course=1 --week=0 --lecture=all --method=transcript
```

### Sync methods

| Method | Behavior |
|---|---|
| `transcript` | Opens YouTube, extracts transcript panel text, saves to `data/transcripts/`, pastes into NotebookLM as a copied text source |
| `url` | Adds the YouTube URL directly as a source in NotebookLM |

---

## Selectors

All CSS selectors live in **`src/config/selectors.ts`**.  
When you have the actual HTML for Swayam, YouTube, and NotebookLM, replace each `PLACEHOLDER_*` string with the real selector.  
No other file needs to change.

---

## Local state

```
data/
├── state.json           ← courses, weeks, lectures, sync records
├── transcripts/
│   └── <course>/
│       └── <week>/
│           └── <lecture>.txt
└── logs/
    ├── combined.log
    ├── error.log
    └── screenshots/     ← debug screenshots (auto-saved on errors)
```

---

## Project structure

```
src/
├── cli/           → Commander commands (init, login, scan, status, sync)
├── browser/       → Playwright context manager + page helpers
├── scrapers/      → Swayam scraper, YouTube transcript extractor
├── automation/    → NotebookLM automation
├── orchestration/ → High-level sync flow
├── state/         → lowdb state DB + TypeScript types
├── config/        → Selectors (all selectors) + Settings (all config)
└── utils/         → Logger, helpers
```

---

## Development

```bash
# Run any command in dev (no compile step)
npx tsx src/cli/index.ts <command>

# Build to dist/
npm run build

# Run built version
node dist/cli/index.js <command>
```

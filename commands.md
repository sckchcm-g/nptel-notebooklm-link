# NPTEL Sync — Commands

## One-time Setup

```bash
npm run dev -- init     # create data/ folders
npm run dev -- login    # log into Swayam + NotebookLM in browser, press Enter when done
npm run dev -- scan     # fetch all courses, weeks, lectures from Swayam
```

---

## Sync Mode (set once per course)

Controls what gets synced to NotebookLM:

| Mode | Local file contains | Added to NotebookLM as |
|------|---------------------|------------------------|
| `transcript` | Full spoken text | Pasted text source |
| `url` | YouTube URL (1 line) | Website/URL source |

```bash
# Set modes (only needed once)
npm run dev -- set-mode --course=2 transcript   # Software Eng → paste full text
npm run dev -- set-mode --course=1 url          # Innovation → YT URL
npm run dev -- set-mode --course=3 url          # Soft Skills → YT URL
npm run dev -- set-mode --course=4 url          # Cloud Computing → YT URL
```

---

## Full Workflow (run in order)

```bash
# Step 1: download transcripts/URLs locally
npm run dev -- sync-local

# Step 2: push everything to NotebookLM
npm run dev -- sync-notebooklm
```

`sync-local` — checks what's missing, downloads all transcripts (or saves YT URLs for url-mode courses).
`sync-notebooklm` — opens browser, navigates to each course's notebook, adds each lecture as a source.

---

## Other Commands

```bash
npm run dev -- status                    # see sync status for all courses
npm run dev -- status --course=2         # status for one course
npm run dev -- status --course=2 --week=1
```

---

## Course Numbers
| # | Course | Suggested mode |
|---|--------|----------------|
| 1 | Innovation, Business Models and Entrepreneurship | url |
| 2 | Introduction to Software Engineering | transcript |
| 3 | Developing Soft Skills and Personality | url |
| 4 | Cloud Computing | url |

---

## Output
```
data/
  state.json                             ← sync state
  courses-config.json                    ← per-course sync modes
  transcripts/
    <course>/<week>/<lecture>.txt        ← transcript text or YouTube URL
```

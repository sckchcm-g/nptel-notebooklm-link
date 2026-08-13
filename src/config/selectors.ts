// ============================================================
// src/config/selectors.ts
//
// ALL CSS selectors for every site — centralized here.
// Nothing is hard-coded elsewhere in the codebase.
// ============================================================

// ── Swayam selectors (swayam.gov.in/mycourses) ───────────────

export const SWAYAM = {
  // Courses list page — scope to #ongoing-grid so we ONLY get enrolled courses,
  // not the 4300+ public catalog cards that also use .course-card
  courseGridContainer: '#ongoing-grid',
  courseCard: '#ongoing-grid .course-card',
  courseTitle: 'p.course-title',
  courseLink: 'a.course-button',   // "Go To Course" button

  // Course page sidebar nav (onlinecourses.nptel.ac.in)
  weekItem: 'nav[aria-label="Course outline"] > div',  // each week wrapper div
  weekTitle: 'h3',                                      // week title inside toggle button
  weekToggle: 'button[aria-expanded]',                  // the expandable toggle button

  // Lecture buttons inside an expanded week
  // Format: div[id="unit-XX-list"] > button
  lectureItem: '> button',       // relative to the week list element
  lectureTitle: 'p.text-sm',     // lecture title paragraph inside button

  // Not used (lectures have no direct href — navigation is click-based)
  lectureLink: '',

  // After clicking a lecture: YouTube video loads in main content area
  // Tries iframe src first; falls back to thumbnail background-image
  embeddedYoutubeIframe: 'iframe[src*="youtube.com/embed"], iframe[src*="youtube.com/watch"]',
  youtubeVideoThumbnail: 'div.ytmVideoCoverThumbnail',   // inside YouTube iframe frame
} as const;

// ── YouTube selectors (youtube.com/watch) ────────────────────

export const YOUTUBE = {
  // Step 1: expand the description to reveal the "Show transcript" button
  expandDescriptionBtn: 'ytd-text-inline-expander tp-yt-paper-button#expand',

  // Step 2: click "Show transcript"
  showTranscriptBtn: 'button[aria-label="Show transcript"]',

  // Transcript panel (the panel that slides in)
  transcriptPanel: 'yt-section-list-renderer[data-target-id="PAmodern_transcript_view"]',

  // Each segment row in the transcript panel
  transcriptSegment: 'transcript-segment-view-model',

  // The actual spoken text inside each segment
  transcriptText: 'span.ytAttributedStringHost[role="text"]',

  // Timestamp label (aria label has human-readable time)
  transcriptTimestamp: '.ytwTranscriptSegmentViewModelTimestampA11yLabel',

  // Fallback: old-style transcript selectors (pre-2024 UI)
  moreActionsButton: '#button[aria-label="More actions"]',
  transcriptMenuItem: 'ytd-menu-service-item-renderer:has-text("Show transcript")',
  transcriptSegmentLegacy: 'ytd-transcript-segment-renderer',
  transcriptTextLegacy: '.segment-text',
} as const;

// ── NotebookLM selectors (notebooklm.google.com) ─────────────

export const NOTEBOOKLM = {
  // ── Homepage: find a notebook by title ───────────────────────
  // Each notebook is a <project-button> custom element in .my-projects-container
  myNotebooksSection: '.my-projects-container',
  createNewNotebookBtn: 'mat-card:has-text("Create new notebook"), .create-new-action-button',
  notebookCard:       'project-button',
  notebookTitle:      'span.project-button-title',
  notebookLink:       'a.primary-action-button[href^="/notebook"]',

  // ── Inside a notebook: source panel ──────────────────────────
  // The "+ Add source" button in the left source panel
  addSourceBtn: 'button[aria-label="Add source"], button:has-text("Add source")',

  // Add source dialog options (text-based, stable across UI updates)
  pastedTextOption: 'button:has-text("Copied text"), [data-source-type="copied_text"]',
  urlOption:        'button:has-text("Website"), button:has-text("URL"), [data-source-type="website"]',

  // ── Pasted text dialog ────────────────────────────────────────
  pasteTextArea:  'textarea[placeholder*="text"], textarea[aria-label*="text"]',
  pasteTitleField:'input[placeholder*="title"], input[aria-label*="title"]',
  pasteInsertBtn: 'button:has-text("Insert"), button:has-text("Add")',

  // ── URL / website dialog ──────────────────────────────────────
  urlInput:       'input[placeholder*="url"], input[type="url"], input[aria-label*="URL"]',
  urlInsertBtn:   'button:has-text("Insert"), button:has-text("Add")',

  // ── Source list (to check if already added) ───────────────────
  sourceItem:  'source-chip, [data-source-id]',
  sourceTitle: '[data-source-title], .source-title',
} as const;


// ============================================================
// src/scrapers/notebooklm.ts
//
// Playwright automation for NotebookLM:
//  - ensureNotebooklmLogin() → show Google account picker, wait for user to select
//  - findNotebookUrl()       → find a notebook URL matching a course name
//  - addSourceUrl()          → add a YouTube URL as a source
//  - addSourceText()         → add pasted transcript text as a source
// ============================================================

import readline from 'readline';
import type { Page } from 'playwright';
import { NOTEBOOKLM } from '../config/selectors.js';
import { SETTINGS } from '../config/settings.js';
import { logger } from '../utils/logger.js';

const NLM_BASE = 'https://notebooklm.google.com';
const GOOGLE_ACCOUNT_CHOOSER = 'https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Fnotebooklm.google.com';

// ── Google account login / selection ─────────────────────────

/**
 * Navigates to Google's account chooser so the user can see and
 * pick which Google account to use for NotebookLM.
 * Waits until the browser lands on notebooklm.google.com with
 * notebooks visible (or user presses Enter to continue).
 */
export async function ensureNotebooklmLogin(page: Page): Promise<void> {
  logger.info('Checking NotebookLM login status...');

  // First try: go straight to NLM and see if already logged in
  await page.goto(NLM_BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  const alreadyOnNlm = currentUrl.startsWith(NLM_BASE) || currentUrl.startsWith('https://notebooklm.google.com');

  if (alreadyOnNlm) {
    // Check if notebooks section is visible (means logged in)
    const hasNotebooks = await page.$(NOTEBOOKLM.myNotebooksSection).catch(() => null);
    if (hasNotebooks) {
      logger.info('Already logged into NotebookLM ✓');
      return;
    }
  }

  // Not logged in → navigate to Google account chooser
  console.log('\n' + '─'.repeat(55));
  console.log('🔐  NotebookLM Login Required');
  console.log('─'.repeat(55));
  console.log('   Opening Google account chooser in browser...');
  console.log('   Please select your Google account to continue.');
  console.log('─'.repeat(55) + '\n');

  await page.goto(GOOGLE_ACCOUNT_CHOOSER, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Wait for user to select account and land back on NotebookLM
  // Poll until URL is back on notebooklm.google.com OR user presses Enter
  await waitForLoginOrEnter(page);
}

async function waitForLoginOrEnter(page: Page): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    let resolved = false;
    let pollInterval: ReturnType<typeof setInterval>;

    const done = () => {
      if (resolved) return;
      resolved = true;
      clearInterval(pollInterval);
      rl.close();
      console.log('\n  Proceeding with NotebookLM sync...\n');
      resolve();
    };

    // Auto-detect login completion by polling the URL
    pollInterval = setInterval(async () => {
      try {
        const url = page.url();
        if (url.startsWith('https://notebooklm.google.com')) {
          console.log('\n  ✓ Login detected! Continuing...');
          done();
        }
      } catch { /* page might be navigating */ }
    }, 1500);

    // Also let user press Enter to continue manually
    rl.question('  Press Enter once you have selected your account → ', () => done());
  });
}


/**
 * Navigates to NotebookLM home, finds the user's notebook whose
 * title contains `courseTitle` (case-insensitive partial match).
 * Returns the full URL of the notebook, or null if not found.
 */
export async function findNotebookUrl(
  page: Page,
  courseTitle: string,
): Promise<string | null> {
  logger.info(`Finding NotebookLM notebook for: "${courseTitle}"`);

  await page.goto(NLM_BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Collect all notebook cards in the "Recent notebooks" section
  const notebooks = await page.$$(NOTEBOOKLM.notebookCard);
  const search = courseTitle.toLowerCase();

  for (const card of notebooks) {
    const titleEl = await card.$(NOTEBOOKLM.notebookTitle);
    if (!titleEl) continue;

    const title = (await titleEl.textContent())?.trim().toLowerCase() ?? '';
    const linkEl = await card.$(NOTEBOOKLM.notebookLink);
    const href = await linkEl?.getAttribute('href');

    if (!href) continue;

    // 1. Exact match (best for when user configured notebooklmTitle explicitly)
    if (title === search) {
      const fullUrl = NLM_BASE + href;
      logger.info(`Exact match notebook: "${title.trim()}" → ${fullUrl}`);
      return fullUrl;
    }

    // 2. Fuzzy match: notebook title contains any word of the course title
    const words = search.split(/\s+/).filter((w) => w.length > 3);
    const matches = words.some((word) => title.includes(word));

    if (matches) {
      const fullUrl = NLM_BASE + href;
      logger.info(`Fuzzy match notebook: "${title.trim()}" → ${fullUrl}`);
      return fullUrl;
    }
  }

  logger.info(`Notebook not found. Creating new notebook...`);
  const createBtn = await page.$(NOTEBOOKLM.createNewNotebookBtn);
  if (!createBtn) {
    logger.error('Could not find "Create new notebook" button.');
    return null;
  }

  await createBtn.click();
  
  try {
    await page.waitForURL(/\/notebook\/.+/, { timeout: 15000 });
    const newUrl = page.url();
    logger.info(`✓ Created new notebook → ${newUrl}`);
    return newUrl;
  } catch (err) {
    logger.error('Failed to wait for new notebook navigation.');
    return null;
  }
}

// ── Add a URL source ──────────────────────────────────────────

/**
 * Opens the "Add source" dialog, chooses Website/URL, pastes the
 * YouTube URL, and confirms. Returns true on success.
 */
export async function addSourceUrl(
  page: Page,
  notebookUrl: string,
  youtubeUrl: string,
  sourceTitle: string,
): Promise<boolean> {
  logger.info(`  Adding URL source: ${youtubeUrl}`);

  await page.goto(notebookUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  try {
    // Click "Add source" button
    await page.click(NOTEBOOKLM.addSourceBtn, { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Choose "Website" / URL option
    await page.click(NOTEBOOKLM.urlOption, { timeout: 8000 });
    await page.waitForTimeout(800);

    // Type the URL
    await page.fill(NOTEBOOKLM.urlInput, youtubeUrl);
    await page.waitForTimeout(500);

    // Confirm
    await page.click(NOTEBOOKLM.urlInsertBtn, { timeout: 8000 });
    await page.waitForTimeout(3000); // wait for source to be processed

    logger.info(`  ✓ URL source added: ${sourceTitle}`);
    return true;
  } catch (err) {
    logger.error(`  ✗ Failed to add URL source: ${err}`);
    return false;
  }
}

// ── Add a pasted text source ──────────────────────────────────

/**
 * Opens the "Add source" dialog, chooses "Copied text", pastes the
 * transcript, sets the title, and confirms.
 * Chunks large transcripts if needed (NotebookLM has a ~200k char limit per source).
 */
export async function addSourceText(
  page: Page,
  notebookUrl: string,
  text: string,
  sourceTitle: string,
): Promise<boolean> {
  logger.info(`  Adding text source: "${sourceTitle}" (${text.length} chars)`);

  await page.goto(notebookUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Chunk if too large (NotebookLM limit ~200,000 chars)
  const MAX_CHARS = 190_000;
  const chunks = chunkText(text, MAX_CHARS);
  logger.info(`  Splitting into ${chunks.length} chunk(s)`);

  let allOk = true;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkTitle = chunks.length > 1 ? `${sourceTitle} (${i + 1}/${chunks.length})` : sourceTitle;

    try {
      // Click "Add source"
      await page.click(NOTEBOOKLM.addSourceBtn, { timeout: 10000 });
      await page.waitForTimeout(1000);

      // Choose "Copied text"
      await page.click(NOTEBOOKLM.pastedTextOption, { timeout: 8000 });
      await page.waitForTimeout(800);

      // Fill title if field exists
      try {
        const titleField = await page.$(NOTEBOOKLM.pasteTitleField);
        if (titleField) {
          await titleField.fill(chunkTitle);
        }
      } catch {
        // title field optional
      }

      // Paste transcript text
      const textarea = await page.waitForSelector(NOTEBOOKLM.pasteTextArea, { timeout: 8000 });
      await textarea.click();
      await textarea.fill(chunk);
      await page.waitForTimeout(500);

      // Confirm / Insert
      await page.click(NOTEBOOKLM.pasteInsertBtn, { timeout: 8000 });
      await page.waitForTimeout(4000); // wait for processing

      logger.info(`  ✓ Text chunk ${i + 1}/${chunks.length} added: "${chunkTitle}"`);
    } catch (err) {
      logger.error(`  ✗ Failed to add text chunk ${i + 1}: ${err}`);
      allOk = false;
    }
  }

  return allOk;
}

// ── Helpers ───────────────────────────────────────────────────

function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    // Try to break at a sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('. ', end);
      if (lastPeriod > start + maxChars * 0.8) end = lastPeriod + 2;
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

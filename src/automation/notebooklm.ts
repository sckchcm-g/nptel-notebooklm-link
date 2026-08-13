// ============================================================
// src/automation/notebooklm.ts
// NotebookLM automation: navigate notebooks, add sources,
// apply week labels.
//
// All selectors come from src/config/selectors.ts.
// ============================================================

import type { Page } from 'playwright';
import { NOTEBOOKLM } from '../config/selectors.js';
import { SETTINGS } from '../config/settings.js';
import { logger } from '../utils/logger.js';
import { navigateTo, clickWhenReady, typeInField } from '../browser/helpers.js';

// ── Notebook navigation ───────────────────────────────────────

/**
 * Navigate to NotebookLM home and find a notebook by title.
 * Returns the URL/ID of the matching notebook, or null.
 */
export async function findNotebookByTitle(
  page: Page,
  courseTitle: string,
): Promise<string | null> {
  logger.info(`Finding NotebookLM notebook for course: "${courseTitle}"`);
  await navigateTo(page, SETTINGS.notebooklmUrl);

  await page.waitForSelector(NOTEBOOKLM.notebookCard, {
    timeout: SETTINGS.timeouts.notebooklm,
  });

  // Find all notebook cards, match by title (case-insensitive partial match)
  const notebooks = await page.$$eval(
    NOTEBOOKLM.notebookCard,
    (cards, titleSel) =>
      cards.map((card) => ({
        title: (card.querySelector(titleSel)?.textContent ?? '').trim(),
        href: (card as HTMLAnchorElement).href ?? (card.querySelector('a') as HTMLAnchorElement | null)?.href ?? '',
      })),
    NOTEBOOKLM.notebookTitle,
  );

  const lower = courseTitle.toLowerCase();
  const match = notebooks.find(
    (n) =>
      n.title.toLowerCase().includes(lower) || lower.includes(n.title.toLowerCase()),
  );

  if (!match) {
    logger.warn(`No NotebookLM notebook found matching: "${courseTitle}"`);
    return null;
  }

  logger.info(`Matched notebook: "${match.title}" → ${match.href}`);
  return match.href;
}

/**
 * Open a notebook by its URL.
 */
export async function openNotebook(page: Page, notebookUrl: string): Promise<void> {
  logger.info(`Opening notebook: ${notebookUrl}`);
  await navigateTo(page, notebookUrl);
  // Wait for the add-source button to confirm we're inside the notebook
  await page.waitForSelector(NOTEBOOKLM.addSourceBtn, {
    timeout: SETTINGS.timeouts.notebooklm,
  });
}

// ── Add source: pasted text (transcript) ─────────────────────

/**
 * Add a transcript as a "Copied text" source in the current notebook.
 */
export async function addTranscriptSource(
  page: Page,
  title: string,
  transcriptText: string,
): Promise<void> {
  logger.info(`Adding transcript source: "${title}"`);

  // Open add-source dialog
  await clickWhenReady(page, NOTEBOOKLM.addSourceBtn);

  // Choose 'Copied text' option
  await clickWhenReady(page, NOTEBOOKLM.pastedTextOption);

  // Fill in title
  await typeInField(page, NOTEBOOKLM.pasteTitleField, title);

  // Paste transcript text
  await typeInField(page, NOTEBOOKLM.pasteTextArea, transcriptText);

  // Confirm
  await clickWhenReady(page, NOTEBOOKLM.pasteInsertBtn);

  // Wait for source to appear in list
  await page.waitForSelector(NOTEBOOKLM.sourceItem, {
    timeout: SETTINGS.timeouts.notebooklm,
  });

  logger.info(`Source added: "${title}"`);
}

// ── Add source: YouTube URL ───────────────────────────────────

/**
 * Add a YouTube URL as a source in the current notebook.
 */
export async function addUrlSource(
  page: Page,
  title: string,
  url: string,
): Promise<void> {
  logger.info(`Adding URL source: "${title}" → ${url}`);

  await clickWhenReady(page, NOTEBOOKLM.addSourceBtn);
  await clickWhenReady(page, NOTEBOOKLM.urlOption);

  await typeInField(page, NOTEBOOKLM.urlInput, url);
  await clickWhenReady(page, NOTEBOOKLM.urlInsertBtn);

  await page.waitForSelector(NOTEBOOKLM.sourceItem, {
    timeout: SETTINGS.timeouts.notebooklm,
  });

  logger.info(`URL source added: "${title}"`);
}

// ── Apply week label to a source ──────────────────────────────

/**
 * Find the most recently added source and apply a week label to it.
 * NotebookLM labels act like tags on sources.
 */
export async function applyLabelToLatestSource(
  page: Page,
  weekLabel: string,
): Promise<void> {
  logger.info(`Applying label "${weekLabel}" to source...`);

  // Click the add-label button on the last (most recent) source
  const addLabelBtns = await page.$$(NOTEBOOKLM.addLabelBtn);
  if (addLabelBtns.length === 0) {
    logger.warn('No label button found on source.');
    return;
  }

  const lastBtn = addLabelBtns[addLabelBtns.length - 1];
  await lastBtn.click();

  await typeInField(page, NOTEBOOKLM.labelInput, weekLabel);
  await clickWhenReady(page, NOTEBOOKLM.labelSaveBtn);

  logger.info(`Label "${weekLabel}" applied.`);
}

// ── Check if source already exists ───────────────────────────

/**
 * Check if a source with the given title already exists in the open notebook.
 */
export async function sourceExists(page: Page, title: string): Promise<boolean> {
  try {
    const titles = await page.$$eval(
      NOTEBOOKLM.sourceTitle,
      (els) => els.map((el) => el.textContent?.trim() ?? ''),
    );
    return titles.some((t) => t === title);
  } catch {
    return false;
  }
}

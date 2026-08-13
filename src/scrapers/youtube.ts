// ============================================================
// src/scrapers/youtube.ts
// YouTube transcript extractor.
//
// Real flow (2024/2025 YouTube UI):
//   1. Navigate to the YouTube watch URL
//   2. Click "...more" in the description to expand it
//      → selector: tp-yt-paper-button#expand (inside ytd-text-inline-expander)
//   3. Click "Show transcript" button that appears
//      → selector: button[aria-label="Show transcript"]
//   4. Wait for the transcript panel to appear
//      → selector: yt-section-list-renderer[data-target-id="PAmodern_transcript_view"]
//   5. Collect text from each transcript-segment-view-model
//      → text in span.ytAttributedStringHost[role="text"]
// ============================================================

import type { Page } from 'playwright';
import { YOUTUBE } from '../config/selectors.js';
import { SETTINGS } from '../config/settings.js';
import { logger } from '../utils/logger.js';
import { navigateTo } from '../browser/helpers.js';
import { writeText } from '../utils/helpers.js';

export interface TranscriptResult {
  text: string;
  savedPath: string;
}

/**
 * Navigate to a YouTube video, open the transcript panel,
 * extract all spoken text, save locally, and return the result.
 *
 * @param page       - Playwright page (should already be logged into Google)
 * @param youtubeUrl - Full YouTube watch URL (https://www.youtube.com/watch?v=...)
 * @param savePath   - Absolute path to save the .txt transcript file
 */
export async function extractTranscript(
  page: Page,
  youtubeUrl: string,
  savePath: string,
): Promise<TranscriptResult> {
  logger.info(`Opening YouTube transcript for: ${youtubeUrl}`);
  await navigateTo(page, youtubeUrl);

  // Wait for the video page to fully render
  await page.waitForSelector('ytd-watch-metadata', { timeout: SETTINGS.timeouts.element });
  await page.waitForTimeout(1500);

  // ── Step 1: Click "...more" to expand the description ────────
  // The "Show transcript" button lives inside the expanded description.
  let transcriptOpened = false;

  try {
    // Try the modern UI: description expand button
    const expandBtn = await page.$(YOUTUBE.expandDescriptionBtn);
    if (expandBtn) {
      await expandBtn.click();
      logger.debug('Clicked description expand (…more) button.');
      await page.waitForTimeout(800);
    }

    // ── Step 2: Click "Show transcript" ──────────────────────────
    await page.waitForSelector(YOUTUBE.showTranscriptBtn, { timeout: 8000 });
    await page.click(YOUTUBE.showTranscriptBtn);
    logger.debug('Clicked "Show transcript" button.');
    transcriptOpened = true;
  } catch (err) {
    logger.debug(`Modern transcript UI failed: ${err}. Trying legacy flow…`);
  }

  // ── Legacy fallback: click ⋮ menu → "Show transcript" ────────
  if (!transcriptOpened) {
    try {
      await page.click(YOUTUBE.moreActionsButton);
      await page.waitForTimeout(500);
      await page.click(YOUTUBE.transcriptMenuItem);
      transcriptOpened = true;
    } catch (legacyErr) {
      throw new Error(
        `Could not open transcript panel for ${youtubeUrl}: ${legacyErr}`,
      );
    }
  }

  // ── Step 3: Wait for transcript panel ────────────────────────
  await page.waitForSelector(YOUTUBE.transcriptPanel, {
    timeout: SETTINGS.timeouts.transcript ?? 15000,
  });
  logger.debug('Transcript panel is visible.');
  await page.waitForTimeout(500); // let segments finish rendering

  // ── Step 4: Collect all segment texts ────────────────────────
  const segments = await page.$$eval(
    YOUTUBE.transcriptSegment,
    (els: Element[], textSel: string) =>
      els.map((el) => {
        const textEl = el.querySelector(textSel);
        return (textEl?.textContent ?? '').trim();
      }),
    YOUTUBE.transcriptText,
  );

  const transcriptText = segments.filter((s) => s.length > 0).join('\n');
  logger.info(`Extracted ${segments.length} transcript segments (${transcriptText.length} chars).`);

  if (!transcriptText) {
    throw new Error(`Transcript panel opened but no text was found for ${youtubeUrl}`);
  }

  // ── Step 5: Save locally ──────────────────────────────────────
  await writeText(savePath, transcriptText);
  logger.info(`Transcript saved: ${savePath}`);

  return { text: transcriptText, savedPath: savePath };
}

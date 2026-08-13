// ============================================================
// src/orchestration/sync.ts
// High-level sync orchestrator — ties together Swayam scraper,
// YouTube transcript extractor, and NotebookLM automation.
// ============================================================

import path from 'path';
import type { Page } from 'playwright';
import type { Course, Week, Lecture, SyncMethod, SyncStatus } from '../state/types.js';
import { SETTINGS } from '../config/settings.js';
import { logger } from '../utils/logger.js';
import {
  updateLectureSync,
  setLectureYoutubeUrl,
  setLectureTranscriptPath,
  setNotebooklmNotebookId,
} from '../state/db.js';
import { extractYoutubeLinkFromLecture } from '../scrapers/swayam.js';
import { extractTranscript } from '../scrapers/youtube.js';
import {
  findNotebookByTitle,
  openNotebook,
  addTranscriptSource,
  addUrlSource,
  applyLabelToLatestSource,
  sourceExists,
} from '../automation/notebooklm.js';
import { slugify } from '../utils/helpers.js';

// ── Source title builder ──────────────────────────────────────

/**
 * Build the NotebookLM source title in the format:
 * "<Lecture Title> | <Week Title>"
 */
function buildSourceTitle(lecture: Lecture, week: Week): string {
  return `${lecture.title} | ${week.title}`;
}

// ── Local transcript path builder ─────────────────────────────

function buildTranscriptPath(
  course: Course,
  week: Week,
  lecture: Lecture,
): string {
  return path.join(
    SETTINGS.transcriptsDir,
    slugify(course.title),
    slugify(week.title),
    `${slugify(lecture.title)}.txt`,
  );
}

// ── Single lecture sync ───────────────────────────────────────

export interface SyncLectureParams {
  page: Page;
  course: Course;
  week: Week;
  lecture: Lecture;
  method: SyncMethod;
}

/**
 * Sync one lecture into NotebookLM.
 *
 * Flow:
 *  1. Ensure we have the YouTube URL (scrape lecture page if missing)
 *  2. Find/open the correct NotebookLM notebook
 *  3. Check for duplicate source
 *  4. Depending on method:
 *     - 'transcript': extract transcript → save locally → add as pasted text source
 *     - 'url': add YouTube URL directly as source
 *  5. Apply week label
 *  6. Update local state
 */
export async function syncLecture({
  page,
  course,
  week,
  lecture,
  method,
}: SyncLectureParams): Promise<SyncStatus> {
  const sourceTitle = buildSourceTitle(lecture, week);

  logger.info(
    `\nSyncing: [${course.title}] → [${week.title}] → [${lecture.title}] (method: ${method})`,
  );

  // ── 1. Resolve YouTube URL ────────────────────────────────
  let youtubeUrl = lecture.youtubeUrl;
  if (!youtubeUrl) {
    if (!lecture.url) {
      await updateLectureSync(course.id, week.id, lecture.id, {
        status: 'error',
        error: 'No course URL available to navigate to the lecture.',
      });
      logger.error(`No course URL for "${lecture.title}" — skipping.`);
      return 'error';
    }
    youtubeUrl = await extractYoutubeLinkFromLecture(
      page,
      lecture.url,
      lecture.weekIndex,
      lecture.lectureIndex,
    );
    if (!youtubeUrl) {
      await updateLectureSync(course.id, week.id, lecture.id, {
        status: 'error',
        error: 'Could not extract YouTube URL from lecture (no iframe/thumbnail found).',
      });
      logger.error(`No YouTube URL found for "${lecture.title}" — skipping.`);
      return 'error';
    }
    await setLectureYoutubeUrl(course.id, week.id, lecture.id, youtubeUrl);
  }

  // ── 2. Find/open NotebookLM notebook ─────────────────────
  let notebookUrl = course.notebooklmNotebookId;
  if (!notebookUrl) {
    notebookUrl = await findNotebookByTitle(page, course.title);
    if (!notebookUrl) {
      await updateLectureSync(course.id, week.id, lecture.id, {
        status: 'error',
        error: `No NotebookLM notebook found for course: "${course.title}"`,
      });
      logger.error(`NotebookLM notebook not found for "${course.title}".`);
      return 'error';
    }
    await setNotebooklmNotebookId(course.id, notebookUrl);
  }

  await openNotebook(page, notebookUrl);

  // ── 3. Skip if already synced ─────────────────────────────
  if (await sourceExists(page, sourceTitle)) {
    logger.warn(`Source already exists: "${sourceTitle}" — marking skipped.`);
    await updateLectureSync(course.id, week.id, lecture.id, {
      status: 'skipped',
      notebooklmSourceTitle: sourceTitle,
    });
    return 'skipped';
  }

  // ── 4. Add source ─────────────────────────────────────────
  try {
    if (method === 'transcript') {
      const transcriptPath = buildTranscriptPath(course, week, lecture);

      const { text } = await extractTranscript(page, youtubeUrl, transcriptPath);

      // Re-open the notebook (transcript extraction opened a new tab/page)
      await openNotebook(page, notebookUrl);
      await addTranscriptSource(page, sourceTitle, text);

      await setLectureTranscriptPath(course.id, week.id, lecture.id, transcriptPath);
    } else {
      // method === 'url'
      await addUrlSource(page, sourceTitle, youtubeUrl);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateLectureSync(course.id, week.id, lecture.id, {
      status: 'error',
      error: message,
    });
    logger.error(`Failed to add source for "${lecture.title}": ${message}`);
    return 'error';
  }

  // ── 5. Apply week label ───────────────────────────────────
  try {
    await applyLabelToLatestSource(page, week.title);
  } catch (err) {
    logger.warn(`Could not apply label "${week.title}": ${err}`);
  }

  // ── 6. Update state ───────────────────────────────────────
  await updateLectureSync(course.id, week.id, lecture.id, {
    status: 'synced',
    method,
    notebooklmSourceTitle: sourceTitle,
    syncedAt: new Date().toISOString(),
    error: null,
  });

  logger.info(`✓ Synced: "${sourceTitle}"`);
  return 'synced';
}

// ── Batch sync ────────────────────────────────────────────────

export interface SyncBatchParams {
  page: Page;
  course: Course;
  weeks: Week[];           // all weeks to sync from
  lectureFilter: 'all' | number; // 'all' or specific 1-based lecture index
  method: SyncMethod;
}

/**
 * Sync multiple lectures in sequence.
 */
export async function syncBatch({
  page,
  course,
  weeks,
  lectureFilter,
  method,
}: SyncBatchParams): Promise<{ synced: number; skipped: number; errors: number }> {
  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const week of weeks) {
    const lectures =
      lectureFilter === 'all'
        ? week.lectures
        : week.lectures.filter((_, i) => i + 1 === lectureFilter);

    for (const lecture of lectures) {
      if (lecture.sync.status === 'synced') {
        logger.info(`Already synced: "${lecture.title}" — skipping.`);
        skipped++;
        continue;
      }

      const result = await syncLecture({ page, course, week, lecture, method });

      if (result === 'synced') synced++;
      else if (result === 'skipped') skipped++;
      else errors++;
    }
  }

  return { synced, skipped, errors };
}

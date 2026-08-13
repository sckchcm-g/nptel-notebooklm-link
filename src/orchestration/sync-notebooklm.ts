// ============================================================
// src/orchestration/sync-notebooklm.ts
//
// For each pending lecture:
//   - url mode  → add YouTube URL as a source in NotebookLM
//   - transcript mode → paste transcript text as a source
//
// Each course maps to one NotebookLM notebook.
// ============================================================

import fs from 'fs/promises';
import path from 'path';
import type { Page } from 'playwright';
import type { Course, Week, Lecture } from '../state/types.js';
import { getAllCourses, updateLectureSync } from '../state/db.js';
import { readCoursesConfig } from '../config/courses-config.js';
import type { SyncMode } from '../config/courses-config.js';
import { logger } from '../utils/logger.js';
import { slugify } from '../utils/helpers.js';
import { SETTINGS } from '../config/settings.js';
import {
  ensureNotebooklmLogin,
  findNotebookUrl,
  addSourceUrl,
  addSourceText,
} from '../scrapers/notebooklm.js';

// ── Local transcript file path (mirrors sync-local.ts) ────────

function transcriptFilePath(course: Course, week: Week, lecture: Lecture): string {
  return path.join(
    SETTINGS.transcriptsDir,
    slugify(course.title),
    slugify(week.title),
    `${slugify(lecture.title)}.txt`,
  );
}

// ── Sync one lecture → NotebookLM ────────────────────────────

export async function syncLectureToNotebooklm(
  page: Page,
  course: Course,
  week: Week,
  lecture: Lecture,
  mode: SyncMode,
  notebookUrl: string,
): Promise<'synced' | 'error'> {
  logger.info(`\n[NLM-${mode.toUpperCase()}] [${week.title}] → [${lecture.title}]`);

  const sourceTitle = `[${week.title}] ${lecture.title}`;

  try {
    let ok = false;

    if (mode === 'url') {
      // ── URL mode: add YouTube URL directly ─────────────────
      const ytUrl = lecture.youtubeUrl;
      if (!ytUrl) {
        throw new Error('No YouTube URL in state — run sync-local first.');
      }
      ok = await addSourceUrl(page, notebookUrl, ytUrl, sourceTitle);
    } else {
      // ── Transcript mode: read .txt file and paste ──────────
      const filePath = transcriptFilePath(course, week, lecture);
      let text: string;
      try {
        text = await fs.readFile(filePath, 'utf-8');
      } catch {
        throw new Error(`Transcript file not found: ${filePath} — run sync-local first.`);
      }

      ok = await addSourceText(page, notebookUrl, text, sourceTitle);
    }

    if (ok) {
      await updateLectureSync(course.id, week.id, lecture.id, {
        status: 'synced',
        method: mode,
        notebooklmSourceTitle: sourceTitle,
        syncedAt: new Date().toISOString(),
        error: null,
      });
      return 'synced';
    } else {
      throw new Error('addSource returned false');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateLectureSync(course.id, week.id, lecture.id, {
      status: 'error',
      method: mode,
      notebooklmSourceTitle: null,
      syncedAt: null,
      error: msg,
    });
    logger.error(`  ✗ ${msg}`);
    return 'error';
  }
}

// ── Batch sync ────────────────────────────────────────────────

export interface NlmSyncResult {
  synced: number;
  skipped: number;
  errors: number;
  total: number;
}

export async function syncAllToNotebooklm(page: Page): Promise<NlmSyncResult> {
  // ── Step 0: ensure logged into NotebookLM ────────────────────
  await ensureNotebooklmLogin(page);

  const courses = await getAllCourses();
  let synced = 0, skipped = 0, errors = 0, total = 0;

  // Cache notebook URLs per course (avoid re-navigating to homepage repeatedly)
  const notebookUrlCache = new Map<string, string | null>();

  for (let ci = 0; ci < courses.length; ci++) {
    const course = courses[ci];
    const { mode, notebooklmTitle } = await getCourseConfig(ci + 1);
    const targetTitle = notebooklmTitle || course.title;

    // Find this course's notebook URL (once per course)
    if (!notebookUrlCache.has(course.id)) {
      const url = await findNotebookUrl(page, targetTitle);
      notebookUrlCache.set(course.id, url);
    }

    const notebookUrl = notebookUrlCache.get(course.id);
    if (!notebookUrl) {
      logger.warn(`No NotebookLM notebook found for "${course.title}" — skipping all lectures.`);
      skipped += course.weeks.reduce((a, w) => a + w.lectures.length, 0);
      continue;
    }

    for (const week of course.weeks) {
      for (const lecture of week.lectures) {
        // Only sync lectures that have a local file/URL ready but not yet in NotebookLM
        if (lecture.sync.notebooklmSourceTitle) {
          skipped++;
          continue;
        }

        // For url mode: need youtubeUrl in state
        // For transcript mode: need transcript file
        const ready = mode === 'url'
          ? !!lecture.youtubeUrl
          : await fileExists(transcriptFilePath(course, week, lecture));

        if (!ready) {
          logger.warn(`  Skipping "${lecture.title}" — run sync-local first.`);
          skipped++;
          continue;
        }

        total++;
        const result = await syncLectureToNotebooklm(page, course, week, lecture, mode, notebookUrl);
        if (result === 'synced') synced++;
        else errors++;

        // Delay between sources to avoid rate limiting
        await page.waitForTimeout(2000);
      }
    }
  }

  return { synced, skipped, errors, total };
}

async function fileExists(filePath: string): Promise<boolean> {
  try { await fs.access(filePath); return true; } catch { return false; }
}

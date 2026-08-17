// ============================================================
// src/orchestration/sync-local.ts
// ============================================================

import path from 'path';
import fs from 'fs/promises';
import type { Page } from 'playwright';
import type { Course, Week, Lecture, SyncStatus } from '../state/types.js';
import { SETTINGS } from '../config/settings.js';
import { logger } from '../utils/logger.js';
import { slugify } from '../utils/helpers.js';
import { extractYoutubeLinkFromLecture } from '../scrapers/swayam.js';
import { extractTranscript } from '../scrapers/youtube.js';
import { getAllCourses, updateLectureSync, setLectureYoutubeUrl } from '../state/db.js';
import { getCourseConfig } from '../config/courses-config.js';
import type { SyncMode } from '../config/courses-config.js';

// ── Path helper ───────────────────────────────────────────────

export function transcriptFilePath(course: Course, week: Week, lecture: Lecture): string {
  return path.join(
    SETTINGS.transcriptsDir,
    slugify(course.title),
    slugify(week.title),
    `${slugify(lecture.title)}.txt`,
  );
}

// ── Check phase (no browser) ──────────────────────────────────

export interface CheckResult {
  course: Course;
  week: Week;
  lecture: Lecture;
  filePath: string;
  fileExists: boolean;
  mode: SyncMode;
}

/**
 * Compare scanned state vs local transcript files.
 * Updates lecture sync status in state:
 *   - file exists   → 'synced'
 *   - file missing  → 'pending'
 * Returns full list of results (with mode from courses-config.json).
 */
export async function checkLocalSync(): Promise<CheckResult[]> {
  const courses = await getAllCourses();
  const results: CheckResult[] = [];

  for (let ci = 0; ci < courses.length; ci++) {
    const course = courses[ci];
    const { mode } = await getCourseConfig(ci + 1);

    for (const week of course.weeks) {
      for (const lecture of week.lectures) {
        const filePath = transcriptFilePath(course, week, lecture);

        let fileExists = false;
        if (mode === 'url') {
          fileExists = !!lecture.youtubeUrl;
        } else {
          try {
            await fs.access(filePath);
            fileExists = true;
          } catch {
            fileExists = false;
          }
        }

        const newStatus: SyncStatus = fileExists ? 'synced' : 'pending';
        if (lecture.sync.status !== newStatus) {
          await updateLectureSync(course.id, week.id, lecture.id, {
            status: newStatus,
            method: fileExists ? (mode) : null,
            notebooklmSourceTitle: null,
            syncedAt: fileExists ? (lecture.sync.syncedAt ?? new Date().toISOString()) : null,
            error: null,
          });
        }

        results.push({ course, week, lecture, filePath, fileExists, mode });
      }
    }
  }

  return results;
}

// ── Run phase (browser needed) ────────────────────────────────

export async function syncLectureLocally(
  page: Page,
  course: Course,
  week: Week,
  lecture: Lecture,
  mode: SyncMode,
): Promise<SyncStatus> {
  const savePath = transcriptFilePath(course, week, lecture);

  logger.info(`\n[${mode.toUpperCase()}] [${week.title}] → [${lecture.title}]`);

  // ── 1. Resolve YouTube URL ────────────────────────────────────
  let youtubeUrl = lecture.youtubeUrl;
  if (!youtubeUrl) {
    logger.info(`  Extracting YouTube URL...`);
    youtubeUrl = await extractYoutubeLinkFromLecture(
      page,
      lecture.url,
      lecture.weekIndex,
      lecture.lectureIndex,
    );

    if (!youtubeUrl) {
      await updateLectureSync(course.id, week.id, lecture.id, {
        status: 'error',
        method: mode,
        notebooklmSourceTitle: null,
        syncedAt: null,
        error: 'Could not extract YouTube URL from lecture player.',
      });
      logger.error(`  ✗ No YouTube URL found.`);
      return 'error';
    }

    await setLectureYoutubeUrl(course.id, week.id, lecture.id, youtubeUrl);
    logger.info(`  YouTube: ${youtubeUrl}`);
  }

  // ── 2. Ensure directory exists ────────────────────────────────
  await fs.mkdir(path.dirname(savePath), { recursive: true });

  // ── 3a. URL mode: write YouTube URL to file (fast, no YT page visit) ──
  if (mode === 'url') {
    try {
      const urlsFile = path.join(path.dirname(savePath), 'youtube-urls.txt');
      await fs.appendFile(urlsFile, youtubeUrl + '\n', 'utf-8');
      
      await updateLectureSync(course.id, week.id, lecture.id, {
        status: 'synced',
        method: 'url',
        notebooklmSourceTitle: null,
        syncedAt: new Date().toISOString(),
        error: null,
      });
      logger.info(`  ✓ URL appended to: ${urlsFile}`);
      return 'synced';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await updateLectureSync(course.id, week.id, lecture.id, {
        status: 'error', method: 'url', notebooklmSourceTitle: null, syncedAt: null, error: msg,
      });
      logger.error(`  ✗ Failed: ${msg}`);
      return 'error';
    }
  }

  // ── 3b. Transcript mode: navigate to YouTube, extract text ────
  try {
    await extractTranscript(page, youtubeUrl, savePath);
    await updateLectureSync(course.id, week.id, lecture.id, {
      status: 'synced',
      method: 'transcript',
      notebooklmSourceTitle: null,
      syncedAt: new Date().toISOString(),
      error: null,
    });
    logger.info(`  ✓ Transcript saved: ${savePath}`);
    return 'synced';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateLectureSync(course.id, week.id, lecture.id, {
      status: 'error', method: 'transcript', notebooklmSourceTitle: null, syncedAt: null, error: msg,
    });
    logger.error(`  ✗ Failed: ${msg}`);
    return 'error';
  }
}

/**
 * Run sync for all pending lectures.
 * Reads mode from data/courses-config.json for each course.
 */
export async function runPendingSync(
  page: Page,
): Promise<{ synced: number; errors: number; total: number }> {
  const courses = await getAllCourses();
  let synced = 0;
  let errors = 0;
  let total = 0;

  for (let ci = 0; ci < courses.length; ci++) {
    const course = courses[ci];
    const { mode } = await getCourseConfig(ci + 1);

    for (const week of course.weeks) {
      for (const lecture of week.lectures) {
        if (lecture.sync.status !== 'pending') continue;

        total++;
        const result = await syncLectureLocally(page, course, week, lecture, mode);
        if (result === 'synced') synced++;
        else errors++;

        await page.waitForTimeout(500);
      }
    }
  }

  return { synced, errors, total };
}

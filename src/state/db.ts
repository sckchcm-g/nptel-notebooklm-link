// ============================================================
// src/state/db.ts
// lowdb-based local state database.
// All reads/writes go through this module.
// ============================================================

import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { SETTINGS } from '../config/settings.js';
import type { AppState, Course, Week, Lecture, SyncRecord, SyncMode } from './types.js';
import { ensureDir } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';

// ── Default (empty) state ────────────────────────────────────

function defaultState(): AppState {
  return {
    version: SETTINGS.stateVersion,
    lastScan: null,
    courses: [],
  };
}

// ── Singleton DB instance ────────────────────────────────────

let _db: Low<AppState> | null = null;

export async function getDb(): Promise<Low<AppState>> {
  if (_db) return _db;

  await ensureDir(SETTINGS.dataDir);

  const adapter = new JSONFile<AppState>(SETTINGS.stateFile);
  const db = new Low<AppState>(adapter, defaultState());
  await db.read();

  // Migrate if state file was empty
  if (!db.data) {
    db.data = defaultState();
    await db.write();
  }

  _db = db;
  return db;
}

// ── Course helpers ────────────────────────────────────────────

export async function getAllCourses(): Promise<Course[]> {
  const db = await getDb();
  return db.data.courses;
}

export async function getCourseByIndex(index: number): Promise<Course | undefined> {
  const db = await getDb();
  return db.data.courses[index - 1]; // 1-indexed for CLI
}

export async function upsertCourses(courses: Course[]): Promise<void> {
  const db = await getDb();
  // Merge: preserve sync records for existing lectures
  for (const incoming of courses) {
    const existing = db.data.courses.find((c) => c.id === incoming.id);
    if (existing) {
      incoming.notebooklmNotebookId = existing.notebooklmNotebookId;
      incoming.syncMode = existing.syncMode ?? 'transcript'; // preserve user-set mode
      for (const week of incoming.weeks) {
        const existingWeek = existing.weeks.find((w) => w.id === week.id);
        if (existingWeek) {
          for (const lecture of week.lectures) {
            const existingLecture = existingWeek.lectures.find((l) => l.id === lecture.id);
            if (existingLecture) {
              lecture.sync = existingLecture.sync;
              lecture.transcriptPath = existingLecture.transcriptPath;
              lecture.youtubeUrl = existingLecture.youtubeUrl;
            }
          }
        }
      }
    }
  }
  db.data.courses = courses;
  db.data.lastScan = new Date().toISOString();
  await db.write();
  logger.info(`State updated: ${courses.length} courses saved.`);
}

// ── Lecture helpers ───────────────────────────────────────────

export async function getLecture(
  courseIdx: number,
  weekIdx: number,
  lectureIdx: number,
): Promise<Lecture | undefined> {
  const course = await getCourseByIndex(courseIdx);
  if (!course) return undefined;
  const week = course.weeks[weekIdx - 1];
  if (!week) return undefined;
  return week.lectures[lectureIdx - 1];
}

export async function updateLectureSync(
  courseId: string,
  weekId: string,
  lectureId: string,
  sync: Partial<SyncRecord>,
): Promise<void> {
  const db = await getDb();
  const course = db.data.courses.find((c) => c.id === courseId);
  if (!course) return;
  const week = course.weeks.find((w) => w.id === weekId);
  if (!week) return;
  const lecture = week.lectures.find((l) => l.id === lectureId);
  if (!lecture) return;

  lecture.sync = { ...lecture.sync, ...sync };
  await db.write();
}

export async function setLectureYoutubeUrl(
  courseId: string,
  weekId: string,
  lectureId: string,
  youtubeUrl: string,
): Promise<void> {
  const db = await getDb();
  const course = db.data.courses.find((c) => c.id === courseId);
  const week = course?.weeks.find((w) => w.id === weekId);
  const lecture = week?.lectures.find((l) => l.id === lectureId);
  if (!lecture) return;

  lecture.youtubeUrl = youtubeUrl;
  await db.write();
}

export async function setLectureTranscriptPath(
  courseId: string,
  weekId: string,
  lectureId: string,
  transcriptPath: string,
): Promise<void> {
  const db = await getDb();
  const course = db.data.courses.find((c) => c.id === courseId);
  const week = course?.weeks.find((w) => w.id === weekId);
  const lecture = week?.lectures.find((l) => l.id === lectureId);
  if (!lecture) return;

  lecture.transcriptPath = transcriptPath;
  await db.write();
}

export async function setNotebooklmNotebookId(
  courseId: string,
  notebookId: string,
): Promise<void> {
  const db = await getDb();
  const course = db.data.courses.find((c) => c.id === courseId);
  if (!course) return;
  course.notebooklmNotebookId = notebookId;
  await db.write();
}
export async function setCourseMode(
  courseId: string,
  mode: SyncMode,
): Promise<void> {
  const db = await getDb();
  const course = db.data.courses.find((c) => c.id === courseId);
  if (!course) return;
  course.syncMode = mode;
  await db.write();
  logger.info(`Course "${course.title}" sync mode set to: ${mode}`);
}

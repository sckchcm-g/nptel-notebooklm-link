// ============================================================
// src/config/courses-config.ts
// Manages data/courses-config.json — a simple per-course
// config file that controls how each course is synced.
//
// Format:
// {
//   "1": { "mode": "transcript" },
//   "2": { "mode": "url", "notebooklmTitle": "NPTEL Intro to Software" }
// }
//
// If a course has no entry, defaults to mode="transcript".
// ============================================================

import fs from 'fs/promises';
import path from 'path';
import { SETTINGS } from './settings.js';

export type SyncMode = 'transcript' | 'url';

export interface CourseConfigEntry {
  mode: SyncMode;
  notebooklmTitle?: string;
}

export type CourseConfigMap = Record<string, CourseConfigEntry>;

const CONFIG_FILE = path.join(SETTINGS.dataDir, 'courses-config.json');

// ── Read ──────────────────────────────────────────────────────

export async function readCoursesConfig(): Promise<CourseConfigMap> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const result: CourseConfigMap = {};

    // Handle migration from old string-based format to new object-based format
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === 'string') {
        result[key] = { mode: val as SyncMode };
      } else {
        result[key] = val as CourseConfigEntry;
      }
    }
    return result;
  } catch {
    return {}; // file doesn't exist yet → all courses default to transcript
  }
}

// ── Write ─────────────────────────────────────────────────────

export async function writeCoursesConfig(config: CourseConfigMap): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

// ── Get mode for one course ───────────────────────────────────

export async function getCourseConfig(courseIndex: number): Promise<CourseConfigEntry> {
  const config = await readCoursesConfig();
  return config[String(courseIndex)] ?? { mode: 'transcript' };
}

// ── Set mode for one course ───────────────────────────────────

export async function setCourseConfig(courseIndex: number, entry: CourseConfigEntry): Promise<void> {
  const config = await readCoursesConfig();
  config[String(courseIndex)] = entry;
  await writeCoursesConfig(config);
}

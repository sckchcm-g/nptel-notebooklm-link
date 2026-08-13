// ============================================================
// src/config/settings.ts
// Central application configuration. Edit paths/URLs/timeouts here.
// ============================================================

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Project root = two levels up from src/config/
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export const SETTINGS = {
  // ── URLs ──────────────────────────────────────────────────
  swayamBaseUrl: 'https://swayam.gov.in',
  swayamCoursesUrl: 'https://swayam.gov.in/mycourses',
  notebooklmUrl: 'https://notebooklm.google.com',
  youtubeBaseUrl: 'https://www.youtube.com',

  // ── Local paths ───────────────────────────────────────────
  browserProfileDir: path.join(PROJECT_ROOT, '.browser-profile'),
  dataDir: path.join(PROJECT_ROOT, 'data'),
  transcriptsDir: path.join(PROJECT_ROOT, 'data', 'transcripts'),
  stateFile: path.join(PROJECT_ROOT, 'data', 'state.json'),
  logsDir: path.join(PROJECT_ROOT, 'data', 'logs'),

  // ── Timeouts (ms) ─────────────────────────────────────────
  timeouts: {
    navigation: 30_000,
    element: 10_000,
    transcript: 20_000,
    notebooklm: 15_000,
  },

  // ── State ─────────────────────────────────────────────────
  stateVersion: '1.0',
} as const;

// ============================================================
// src/utils/helpers.ts
// Generic utility functions used across the project.
// ============================================================

import fs from 'fs/promises';
import path from 'path';

/**
 * Slugify a string for use as a directory name.
 * E.g. "Week 1: Introduction to ML" → "week-1-introduction-to-ml"
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Ensure a directory exists (creates recursively if not).
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Write text content to a file, creating parent dirs as needed.
 */
export async function writeText(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Read a text file, returning null if it doesn't exist.
 */
export async function readText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Extract a YouTube video ID from any YouTube URL format.
 */
export function extractYoutubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.slice(1) || null;
    }
    if (parsed.hostname.includes('youtube.com')) {
      return parsed.searchParams.get('v');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Normalize a YouTube URL to the standard watch?v= format.
 */
export function normalizeYoutubeUrl(url: string): string {
  const id = extractYoutubeId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : url;
}

/**
 * Zero-pad a number to a given width.
 */
export function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

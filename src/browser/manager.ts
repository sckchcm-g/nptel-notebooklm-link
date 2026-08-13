// ============================================================
// src/browser/manager.ts
// Manages the Playwright persistent browser context.
// Uses a project-local Chromium install, not system Chrome.
// ============================================================

import { chromium, type BrowserContext, type Browser } from 'playwright';
import path from 'path';
import { SETTINGS } from '../config/settings.js';
import { logger } from '../utils/logger.js';
import { ensureDir } from '../utils/helpers.js';

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;

/**
 * Return (or create) the shared persistent browser context.
 * The context survives between commands as long as the process lives.
 * Between runs it persists via the profile directory.
 */
export async function getBrowserContext(options?: {
  headless?: boolean;
}): Promise<BrowserContext> {
  if (_context) return _context;

  await ensureDir(SETTINGS.browserProfileDir);

  const headless = options?.headless ?? false;

  logger.info('Launching managed Chromium browser...');

  // persistentContext keeps cookies/localStorage between runs
  const context = await chromium.launchPersistentContext(SETTINGS.browserProfileDir, {
    headless,
    channel: undefined, // use Playwright-bundled Chromium, not system Chrome
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });

  _context = context;
  logger.info('Browser context ready.');
  return context;
}

/**
 * Open a new page in the shared context.
 */
export async function newPage(headless = false) {
  const ctx = await getBrowserContext({ headless });
  const page = await ctx.newPage();
  return page;
}

/**
 * Close the browser (call at process exit).
 */
export async function closeBrowser(): Promise<void> {
  if (_context) {
    await _context.close();
    _context = null;
  }
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

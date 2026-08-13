// ============================================================
// src/browser/helpers.ts
// Playwright page helpers: safe waits, screenshot, scroll, etc.
// ============================================================

import type { Page } from 'playwright';
import { SETTINGS } from '../config/settings.js';
import { logger } from '../utils/logger.js';

/**
 * Wait for a selector and return its text content.
 */
export async function getText(page: Page, selector: string): Promise<string> {
  await page.waitForSelector(selector, { timeout: SETTINGS.timeouts.element });
  return (await page.textContent(selector)) ?? '';
}

/**
 * Wait for a selector and click it.
 */
export async function clickWhenReady(
  page: Page,
  selector: string,
  timeout = SETTINGS.timeouts.element,
): Promise<void> {
  await page.waitForSelector(selector, { timeout });
  await page.click(selector);
}

/**
 * Type text into a field after clearing it.
 */
export async function typeInField(
  page: Page,
  selector: string,
  text: string,
): Promise<void> {
  await page.waitForSelector(selector, { timeout: SETTINGS.timeouts.element });
  await page.fill(selector, '');
  await page.type(selector, text, { delay: 30 });
}

/**
 * Navigate and wait for network idle.
 */
export async function navigateTo(page: Page, url: string): Promise<void> {
  logger.debug(`Navigating to: ${url}`);
  await page.goto(url, {
    waitUntil: 'networkidle',
    timeout: SETTINGS.timeouts.navigation,
  });
}

/**
 * Get attribute value from a selector.
 */
export async function getAttribute(
  page: Page,
  selector: string,
  attribute: string,
): Promise<string | null> {
  await page.waitForSelector(selector, { timeout: SETTINGS.timeouts.element });
  return page.getAttribute(selector, attribute);
}

/**
 * Take a debug screenshot to data/logs/screenshots/.
 */
export async function debugScreenshot(page: Page, name: string): Promise<void> {
  const { default: path } = await import('path');
  const { ensureDir } = await import('../utils/helpers.js');
  const screenshotDir = path.join(SETTINGS.logsDir, 'screenshots');
  await ensureDir(screenshotDir);
  const filePath = path.join(screenshotDir, `${Date.now()}-${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  logger.debug(`Screenshot saved: ${filePath}`);
}

/**
 * Wait for navigation to a URL pattern.
 */
export async function waitForUrl(page: Page, pattern: string | RegExp): Promise<void> {
  await page.waitForURL(pattern, { timeout: SETTINGS.timeouts.navigation });
}

/**
 * Extract all matching elements' text and href attributes.
 */
export async function extractLinks(
  page: Page,
  selector: string,
): Promise<Array<{ text: string; href: string }>> {
  await page.waitForSelector(selector, { timeout: SETTINGS.timeouts.element });
  return page.$$eval(selector, (els) =>
    els.map((el) => ({
      text: (el.textContent ?? '').trim(),
      href: (el as HTMLAnchorElement).href ?? '',
    })),
  );
}

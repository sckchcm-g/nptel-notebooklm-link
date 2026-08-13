// ============================================================
// src/cli/login.ts
// `nptel-sync login` — open managed browser so the user can
// manually log into Swayam, Google, and NotebookLM once.
// The session is persisted in .browser-profile/.
// ============================================================

import readline from 'readline';
import chalk from 'chalk';
import { getBrowserContext } from '../browser/manager.js';
import { SETTINGS } from '../config/settings.js';
import { logger } from '../utils/logger.js';

export async function runLogin(): Promise<void> {
  console.log(chalk.cyan('\n🔐  Opening managed browser for manual login...\n'));
  console.log(chalk.gray('  Your session will be saved in:'), chalk.bold(SETTINGS.browserProfileDir));
  console.log(chalk.yellow('\n  Please log in to:'));
  console.log(chalk.white('    1. Swayam  →', SETTINGS.swayamCoursesUrl));
  console.log(chalk.white('    2. Google  → (used by Swayam SSO & NotebookLM)'));
  console.log(chalk.white('    3. NotebookLM →', SETTINGS.notebooklmUrl));
  console.log(chalk.dim('\n  Press Enter here once you are fully logged in.\n'));

  const ctx = await getBrowserContext({ headless: false });

  // Open tabs for each site
  const swayamPage = await ctx.newPage();
  await swayamPage.goto(SETTINGS.swayamCoursesUrl);

  const nlmPage = await ctx.newPage();
  await nlmPage.goto(SETTINGS.notebooklmUrl);

  // Wait for user to confirm
  await waitForEnter();

  await ctx.close();

  console.log(chalk.green('\n✅  Login session saved. Future runs will reuse this session.\n'));
  logger.info('Login complete. Browser profile saved.');
}

function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin });
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

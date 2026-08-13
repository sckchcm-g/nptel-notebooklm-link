// ============================================================
// src/cli/init.ts
// `nptel-sync init` — create all required local directories
// and an empty state file.
// ============================================================

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { SETTINGS } from '../config/settings.js';
import { logger } from '../utils/logger.js';
import { ensureDir } from '../utils/helpers.js';

export async function runInit(): Promise<void> {
  console.log(chalk.cyan('\n📁  Initializing nptel-sync workspace...\n'));

  const dirs = [
    SETTINGS.dataDir,
    SETTINGS.transcriptsDir,
    SETTINGS.logsDir,
    SETTINGS.browserProfileDir,
    path.join(SETTINGS.logsDir, 'screenshots'),
  ];

  for (const dir of dirs) {
    await ensureDir(dir);
    console.log(chalk.green('  ✓'), chalk.gray(dir));
  }

  // Create empty state file if it doesn't exist
  try {
    await fs.access(SETTINGS.stateFile);
    console.log(chalk.yellow('\n  State file already exists — not overwritten.'));
  } catch {
    const emptyState = {
      version: SETTINGS.stateVersion,
      lastScan: null,
      courses: [],
    };
    await fs.writeFile(SETTINGS.stateFile, JSON.stringify(emptyState, null, 2), 'utf-8');
    console.log(chalk.green('  ✓'), chalk.gray(SETTINGS.stateFile), chalk.dim('(created)'));
  }

  console.log(chalk.cyan('\n✅  Init complete. Run'), chalk.bold('nptel-sync login'), chalk.cyan('next.\n'));
  logger.info('Init complete.');
}

// ============================================================
// src/cli/sync-local.ts
//
// `nptel-sync sync-local`
//
// Automatically:
//   1. Checks all scanned lectures vs local transcript files
//   2. Marks missing ones as pending
//   3. Opens browser and syncs all pending ones
//   4. Saves to data/transcripts/<course>/<week>/<lecture>.txt
// ============================================================

import chalk from 'chalk';
import { getAllCourses } from '../state/db.js';
import { newPage, closeBrowser } from '../browser/manager.js';
import { checkLocalSync, runPendingSync } from '../orchestration/sync-local.js';
import { logger } from '../utils/logger.js';
import { SETTINGS } from '../config/settings.js';

export async function runSyncLocal(): Promise<void> {
  console.log(chalk.cyan('\n🔎  Checking what needs to be synced...\n'));

  // ── Phase 1: diff local files vs state (no browser) ──────────
  const results = await checkLocalSync();

  const pending = results.filter((r) => !r.fileExists);
  const alreadySynced = results.filter((r) => r.fileExists);

  console.log(chalk.green(`  ✓ Already saved : ${alreadySynced.length}`));
  console.log(
    pending.length > 0
      ? chalk.yellow(`  ● Need syncing  : ${pending.length}`)
      : chalk.green(`  ✓ Need syncing  : 0`),
  );

  if (pending.length === 0) {
    console.log(chalk.green('\n✅  All transcripts already saved. Nothing to do!\n'));
    return;
  }

  // Show what will be synced
  console.log(chalk.cyan('\n  Lectures to sync:'));
  const byCourse = new Map<string, typeof pending>();
  for (const r of pending) {
    if (!byCourse.has(r.course.title)) byCourse.set(r.course.title, []);
    byCourse.get(r.course.title)!.push(r);
  }
  for (const [courseTitle, lectures] of byCourse) {
    console.log(chalk.bold(`\n    ${courseTitle}`));
    for (const r of lectures) {
      console.log(chalk.dim(`      [${r.week.title}]`), r.lecture.title);
    }
  }

  console.log(chalk.dim(`\n  Output: ${SETTINGS.transcriptsDir}`));
  console.log();

  // ── Phase 2: open browser, sync all pending ───────────────────
  console.log(chalk.cyan(`📥  Syncing ${pending.length} lecture(s)...\n`));

  try {
    const page = await newPage(true);
    const { synced, errors, total } = await runPendingSync(page);
    await closeBrowser();

    console.log(chalk.cyan('\n── Summary ───────────────────────────────'));
    console.log(chalk.green(`  ✓ Saved  : ${synced} / ${total}`));
    if (errors > 0) console.log(chalk.red(`  ✗ Errors : ${errors}`));
    console.log(chalk.cyan('──────────────────────────────────────────'));
    console.log(chalk.dim('\n  Files saved in:'), chalk.bold(SETTINGS.transcriptsDir + '\n'));
  } catch (err) {
    logger.error(`Sync failed: ${err}`);
    await closeBrowser();
    process.exit(1);
  }
}

// ============================================================
// src/cli/sync-notebooklm.ts
// `nptel-sync sync-notebooklm`
//
// Adds all locally-ready lectures as sources in NotebookLM.
// Reads sync mode from data/courses-config.json:
//   url        → adds YouTube URL to notebook
//   transcript → pastes full transcript text to notebook
//
// Prerequisite: run `sync-local` first to have local files/URLs.
// ============================================================

import chalk from 'chalk';
import { newPage, closeBrowser } from '../browser/manager.js';
import { syncAllToNotebooklm } from '../orchestration/sync-notebooklm.js';
import { logger } from '../utils/logger.js';

export async function runSyncNotebooklm(): Promise<void> {
  console.log(chalk.cyan('\n🤖  Starting NotebookLM sync...\n'));
  console.log(chalk.dim('  This will open your browser and add sources to each NotebookLM notebook.'));
  console.log(chalk.dim('  Make sure you have run `sync-local` first.\n'));

  try {
    const page = await newPage(true);
    const { synced, skipped, errors, total } = await syncAllToNotebooklm(page);
    await closeBrowser();

    console.log(chalk.cyan('\n── NotebookLM Sync Summary ───────────────'));
    console.log(chalk.green(`  ✓ Added to NotebookLM : ${synced} / ${total}`));
    console.log(chalk.yellow(`  ⊘ Skipped             : ${skipped}`));
    if (errors > 0) console.log(chalk.red(`  ✗ Errors              : ${errors}`));
    console.log(chalk.cyan('─────────────────────────────────────────\n'));

    if (errors > 0) {
      console.log(chalk.dim('  Run'), chalk.bold('npm run dev -- status'), chalk.dim('to see details.\n'));
    }
  } catch (err) {
    logger.error(`NotebookLM sync failed: ${err}`);
    await closeBrowser();
    process.exit(1);
  }
}

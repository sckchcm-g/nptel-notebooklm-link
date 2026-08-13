#!/usr/bin/env node
// ============================================================
// src/cli/index.ts
// ============================================================

import { Command } from 'commander';
import chalk from 'chalk';
import { runInit } from './init.js';
import { runLogin } from './login.js';
import { runScan } from './scan.js';
import { runStatus } from './status.js';
import { runSync } from './sync.js';
import { runSyncLocal } from './sync-local.js';
import { runSetMode } from './set-mode.js';
import { runSyncNotebooklm } from './sync-notebooklm.js';

const program = new Command();

program
  .name('nptel-sync')
  .description(
    chalk.cyan('NPTEL → NotebookLM sync tool') +
      chalk.dim('\nSync Swayam course transcripts into NotebookLM automatically.'),
  )
  .version('1.0.0');

program
  .command('init')
  .description('Create local data folders and empty state file')
  .action(async () => { await runInit(); });

program
  .command('login')
  .description('Open browser for one-time login to Swayam & NotebookLM')
  .action(async () => { await runLogin(); });

program
  .command('scan')
  .description('Scrape all enrolled courses, weeks, and lectures from Swayam')
  .action(async () => { await runScan(); });

program
  .command('set-mode')
  .description('Set sync mode and NotebookLM title for a course')
  .requiredOption('-c, --course <number>', 'Course number (index from scan)')
  .argument('<mode>', 'Sync mode: transcript | url')
  .option('-n, --notebook <title>', 'Exact NotebookLM notebook title (used for syncing)')
  .action(async (mode, options) => { await runSetMode(options.course, mode, options.notebook); });

program
  .command('status')
  .description('Show sync status for all courses, weeks, and lectures')
  .option('-c, --course <number>', 'Filter by course number')
  .option('-w, --week <number>', 'Filter by week number')
  .action(async (options) => { await runStatus(options); });

program
  .command('sync-local')
  .description('Check what transcripts are missing locally, then sync them all')
  .action(async () => { await runSyncLocal(); });

program
  .command('sync-notebooklm')
  .description('Add all locally-synced lectures as sources in NotebookLM')
  .action(async () => { await runSyncNotebooklm(); });

program
  .command('sync')
  .description('Sync lectures into NotebookLM (URL or transcript method)')
  .requiredOption('-c, --course <number>', 'Course number')
  .requiredOption('-w, --week <number|all>', 'Week number or "all"')
  .requiredOption('-l, --lecture <number|all>', 'Lecture number or "all"')
  .requiredOption('-m, --method <url|transcript>', '"url" or "transcript"')
  .action(async (options) => { await runSync(options); });

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('\n  Unhandled error:'), reason);
  process.exit(1);
});

program.parse(process.argv);

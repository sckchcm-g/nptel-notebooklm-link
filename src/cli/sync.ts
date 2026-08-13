// ============================================================
// src/cli/sync.ts
// `nptel-sync sync` — sync one or many lectures into NotebookLM.
//
// Examples:
//   nptel-sync sync --course=1 --week=1 --lecture=all --method=transcript
//   nptel-sync sync --course=1 --week=2 --lecture=3 --method=url
// ============================================================

import chalk from 'chalk';
import { getAllCourses, getCourseByIndex } from '../state/db.js';
import { newPage, closeBrowser } from '../browser/manager.js';
import { syncBatch } from '../orchestration/sync.js';
import type { SyncOptions, SyncMethod } from '../state/types.js';
import { logger } from '../utils/logger.js';

export async function runSync(options: SyncOptions): Promise<void> {
  // ── Validate options ────────────────────────────────────────
  const courseIdx = parseInt(options.course, 10);
  const weekIdx = parseInt(options.week, 10);
  const method = options.method as SyncMethod;
  const lectureArg = options.lecture; // 'all' or a number string

  if (!['url', 'transcript'].includes(method)) {
    console.error(chalk.red(`\n  Invalid method "${method}". Use: url | transcript\n`));
    process.exit(1);
  }

  const lectureFilter: 'all' | number =
    lectureArg === 'all' ? 'all' : parseInt(lectureArg, 10);

  if (lectureArg !== 'all' && isNaN(lectureFilter as number)) {
    console.error(chalk.red(`\n  Invalid --lecture value "${lectureArg}". Use a number or 'all'.\n`));
    process.exit(1);
  }

  // ── Load state ──────────────────────────────────────────────
  const course = await getCourseByIndex(courseIdx);
  if (!course) {
    console.error(chalk.red(`\n  Course #${courseIdx} not found. Run 'nptel-sync scan' first.\n`));
    process.exit(1);
  }

  const weeks =
    weekIdx === 0
      ? course.weeks                          // week=0 → all weeks
      : [course.weeks[weekIdx - 1]].filter(Boolean);

  if (weeks.length === 0) {
    console.error(chalk.red(`\n  Week #${weekIdx} not found in course "${course.title}".\n`));
    process.exit(1);
  }

  // ── Summary ─────────────────────────────────────────────────
  console.log(chalk.cyan('\n🔄  Starting sync...\n'));
  console.log(chalk.dim('  Course :'), chalk.bold(course.title));
  console.log(
    chalk.dim('  Week   :'),
    chalk.bold(weekIdx === 0 ? 'All weeks' : weeks[0]?.title ?? ''),
  );
  console.log(
    chalk.dim('  Lecture:'),
    chalk.bold(lectureFilter === 'all' ? 'All lectures' : `Lecture #${lectureFilter}`),
  );
  console.log(chalk.dim('  Method :'), chalk.bold(method));
  console.log();

  // ── Run sync ────────────────────────────────────────────────
  try {
    const page = await newPage(false);
    const { synced, skipped, errors } = await syncBatch({
      page,
      course,
      weeks,
      lectureFilter,
      method,
    });

    await closeBrowser();

    // ── Result summary ───────────────────────────────────────
    console.log(chalk.cyan('\n── Sync Summary ──────────────────────'));
    console.log(chalk.green(`  ✓ Synced  : ${synced}`));
    console.log(chalk.yellow(`  ⊘ Skipped : ${skipped}`));
    console.log(chalk.red(`  ✗ Errors  : ${errors}`));
    console.log(chalk.cyan('──────────────────────────────────────\n'));

    if (errors > 0) {
      console.log(
        chalk.dim('  Run'),
        chalk.bold('nptel-sync status'),
        chalk.dim('to see error details.\n'),
      );
    }
  } catch (err) {
    logger.error(`Sync failed: ${err}`);
    await closeBrowser();
    process.exit(1);
  }
}

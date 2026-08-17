// ============================================================
// src/cli/status.ts
// `nptel-sync status` — print a tree of courses → weeks →
// lectures with their current sync status.
// ============================================================

import chalk from 'chalk';
import Table from 'cli-table3';
import { getAllCourses } from '../state/db.js';
import type { StatusOptions } from '../state/types.js';
import { logger } from '../utils/logger.js';

// ── Status color helpers ──────────────────────────────────────

const STATUS_ICON: Record<string, string> = {
  pending: chalk.gray('○ pending'),
  synced: chalk.green('✓ synced'),
  error: chalk.red('✗ error'),
  skipped: chalk.yellow('⊘ skipped'),
};

export async function runStatus(options?: StatusOptions): Promise<void> {
  const courses = await getAllCourses();

  if (courses.length === 0) {
    console.log(chalk.yellow('\n  No courses found. Run'), chalk.bold('nptel-sync scan'), chalk.yellow('first.\n'));
    return;
  }

  const filterCourseIdx = options?.course ? parseInt(options.course, 10) : null;
  const filterWeekIdx = options?.week ? parseInt(options.week, 10) : null;

  const displayCourses = filterCourseIdx
    ? [courses[filterCourseIdx - 1]].filter(Boolean)
    : courses;

  console.log(chalk.cyan('\n📚  Sync Status\n'));

  for (let ci = 0; ci < displayCourses.length; ci++) {
    const course = displayCourses[ci];
    const realIdx = filterCourseIdx ?? ci + 1;

    const totalLectures = course.weeks.reduce((a, w) => a + w.lectures.length, 0);
    const syncedCount = course.weeks.reduce(
      (a, w) => a + w.lectures.filter((l) => l.sync.status === 'synced').length,
      0,
    );

    console.log(
      chalk.bold.blue(`[${realIdx}] ${course.title}`),
      chalk.dim(`(${syncedCount}/${totalLectures} synced)`),
      course.notebooklmNotebookId
        ? chalk.green('• notebook linked')
        : chalk.gray('• notebook not linked'),
    );

    const displayWeeks = filterWeekIdx
      ? [course.weeks[filterWeekIdx - 1]].filter(Boolean)
      : course.weeks;

    for (let wi = 0; wi < displayWeeks.length; wi++) {
      const week = displayWeeks[wi];
      const realWi = filterWeekIdx ?? wi + 1;

      const weekSynced = week.lectures.filter((l) => l.sync.status === 'synced').length;

      console.log(
        chalk.gray(`  │`),
        chalk.bold(`  [${realWi}] ${week.title}`),
        chalk.dim(`(${weekSynced}/${week.lectures.length})`),
      );

      const table = new Table({
        head: [
          chalk.white('#'),
          chalk.white('Lecture'),
          chalk.white('Status'),
          chalk.white('Method'),
          chalk.white('Synced At'),
        ],
        colWidths: [4, 48, 14, 12, 22],
        style: { compact: true, head: [] },
      });

      for (let li = 0; li < week.lectures.length; li++) {
        const lecture = week.lectures[li];
        const sync = lecture.sync;

        table.push([
          String(li + 1),
          lecture.title.length > 45
            ? lecture.title.slice(0, 42) + '...'
            : lecture.title,
          STATUS_ICON[sync.status] ?? sync.status,
          sync.method ?? chalk.dim('—'),
          sync.syncedAt ? new Date(sync.syncedAt).toLocaleString() : chalk.dim('—'),
        ]);

        if (sync.status === 'error' && sync.error) {
          table.push([
            '',
            { content: chalk.red(`  ⚠ ${sync.error}`), colSpan: 4 },
            '',
            '',
            '',
          ]);
        }
      }

      // Indent the table output
      const tableStr = table
        .toString()
        .split('\n')
        .map((line) => '      ' + line)
        .join('\n');
      console.log(tableStr);
    }

    console.log();
  }

  console.log(
    chalk.dim(`Last scan: ${courses[0] ? new Date(0).toISOString() : 'never'}`),
    '\n',
  );
}

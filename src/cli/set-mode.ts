// ============================================================
// src/cli/set-mode.ts
// `nptel-sync set-mode --course=N <transcript|url>`
// Writes to data/courses-config.json
// ============================================================

import chalk from 'chalk';
import { getAllCourses } from '../state/db.js';
import { setCourseConfig, readCoursesConfig } from '../config/courses-config.js';
import type { SyncMode } from '../config/courses-config.js';
import { SETTINGS } from '../config/settings.js';
import path from 'path';

export async function runSetMode(
  courseIndexStr: string,
  mode: string,
  notebookTitle?: string
): Promise<void> {
  if (!['transcript', 'url'].includes(mode)) {
    console.error(chalk.red(`\n  Invalid mode "${mode}". Use: transcript | url\n`));
    process.exit(1);
  }

  const courseIndex = parseInt(courseIndexStr, 10);
  const courses = await getAllCourses();
  const course = courses[courseIndex - 1];
  if (!course) {
    console.error(chalk.red(`\n  Course #${courseIndex} not found. Run 'nptel-sync scan' first.\n`));
    process.exit(1);
  }

  await setCourseConfig(courseIndex, { mode: mode as SyncMode, notebooklmTitle: notebookTitle });

  const configPath = path.join(SETTINGS.dataDir, 'courses-config.json');

  const desc = mode === 'transcript'
    ? 'extract full YouTube transcript text'
    : 'save YouTube URL only → .txt with one line';

  console.log(chalk.green(`\n✓ Course ${courseIndex} — "${course.title}"`));
  console.log(`  Mode: ${chalk.bold(mode)} (${desc})`);
  if (notebookTitle) {
    console.log(`  NotebookLM Title: ${chalk.bold(notebookTitle)}`);
  }
  console.log(chalk.dim(`\n  Config saved to: ${configPath}`));
  
  const config = await readCoursesConfig();
  console.log(chalk.dim('\n  Current config:'));
  for (const [idxStr, entry] of Object.entries(config)) {
    const title = courses[parseInt(idxStr) - 1]?.title ?? 'Unknown Course';
    const notebookInfo = entry.notebooklmTitle ? ` (Notebook: "${entry.notebooklmTitle}")` : '';
    console.log(`    [${idxStr}] ${title} → ${chalk.cyan(entry.mode)}${chalk.dim(notebookInfo)}`);
  }
  console.log();
}

// ============================================================
// src/cli/scan.ts
// `nptel-sync scan` — scrape Swayam and update local state.
// ============================================================

import chalk from 'chalk';
import ora from 'ora';
import { newPage, closeBrowser } from '../browser/manager.js';
import { scrapeCourses, scrapeWeeksAndLectures } from '../scrapers/swayam.js';
import { upsertCourses } from '../state/db.js';
import { logger } from '../utils/logger.js';

export async function runScan(): Promise<void> {
  console.log(chalk.cyan('\n🔍  Scanning Swayam for courses, weeks, and lectures...\n'));

  const spinner = ora('Opening browser...').start();

  try {
    const page = await newPage(false);
    spinner.text = 'Fetching courses...';

    const courses = await scrapeCourses(page);
    spinner.succeed(`Found ${courses.length} courses.`);

    for (let i = 0; i < courses.length; i++) {
      const course = courses[i];
      const weekSpinner = ora(
        `  [${i + 1}/${courses.length}] Scanning "${course.title}"...`,
      ).start();

      try {
        const weeks = await scrapeWeeksAndLectures(page, course.url);
        course.weeks = weeks;

        const totalLectures = weeks.reduce((a, w) => a + w.lectures.length, 0);
        weekSpinner.succeed(
          `  "${course.title}" — ${weeks.length} weeks, ${totalLectures} lectures`,
        );
      } catch (err) {
        weekSpinner.fail(`  "${course.title}" — scan failed: ${err}`);
        logger.error(`Failed to scan course "${course.title}": ${err}`);
      }
    }

    await upsertCourses(courses);
    await closeBrowser();

    console.log(chalk.green('\n✅  Scan complete. Run'), chalk.bold('nptel-sync status'), chalk.green('to view.\n'));
  } catch (err) {
    spinner.fail('Scan failed.');
    logger.error(`Scan error: ${err}`);
    await closeBrowser();
    process.exit(1);
  }
}

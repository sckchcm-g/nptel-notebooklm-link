// ============================================================
// src/scrapers/swayam.ts
// Swayam / NPTEL course, week, and lecture scraper.
//
// Structure on onlinecourses.nptel.ac.in:
//   - Sidebar: nav[aria-label="Course outline"] > div (per week)
//     - button[aria-expanded] → h3 (week title)
//     - div[id="unit-XX-list"] (lecture buttons when expanded)
//       - button > p.text-sm  (lecture title)
//   - Lectures are BUTTONS, not links → navigation is click-based.
//   - weekIndex + lectureIndex are stored on each Lecture for re-navigation.
// ============================================================

import type { Page } from 'playwright';
import { SWAYAM } from '../config/selectors.js';
import { SETTINGS } from '../config/settings.js';
import { logger } from '../utils/logger.js';
import { slugify } from '../utils/helpers.js';
import { navigateTo } from '../browser/helpers.js';
import type { Course, Week, Lecture } from '../state/types.js';

// ── Course list scraping ──────────────────────────────────────

/**
 * Scrape enrolled courses from https://swayam.gov.in/mycourses.
 * Returns title + the "Go To Course" link for each card.
 */
export async function scrapeCourses(page: Page): Promise<Course[]> {
  logger.info('Navigating to Swayam courses page...');
  await navigateTo(page, SETTINGS.swayamCoursesUrl);

  // Wait for the enrolled courses grid specifically (not the public catalog)
  await page.waitForSelector(SWAYAM.courseGridContainer, {
    timeout: SETTINGS.timeouts.element,
  });

  // Also wait a beat for the cards to render inside the grid
  await page.waitForTimeout(1000);

  const rawCourses = await page.$$eval(
    SWAYAM.courseCard,
    (cards: Element[], sels: { title: string; link: string }) =>
      cards.map((card) => ({
        title: card.querySelector(sels.title)?.textContent?.trim() ?? '',
        url: (card.querySelector(sels.link) as HTMLAnchorElement | null)?.href ?? '',
      })),
    { title: SWAYAM.courseTitle, link: SWAYAM.courseLink },
  );

  logger.info(`Found ${rawCourses.length} courses.`);

  return rawCourses
    .filter((c) => c.title && c.url)
    .map((c, i) => ({
      id: `course-${i + 1}-${slugify(c.title)}`,
      title: c.title,
      url: c.url,
      syncMode: 'transcript' as const,  // default; change with set-mode command
      notebooklmNotebookId: null,
      weeks: [],
    }));
}

// ── Week + Lecture scraping ───────────────────────────────────

/**
 * Navigate to a course page and scrape week/lecture structure.
 *
 * NPTEL courses use a React SPA sidebar:
 *  - Each week is a collapsible button in `nav[aria-label="Course outline"]`
 *  - Lectures are <button> elements inside the expanded week list
 *  - Only items whose title starts with "Lecture" are included
 *  - weekIndex/lectureIndex are stored so the sync step can click the right button
 */
export async function scrapeWeeksAndLectures(
  page: Page,
  courseUrl: string,
): Promise<Week[]> {
  logger.info(`Scraping weeks for: ${courseUrl}`);
  await navigateTo(page, courseUrl);

  await page.waitForSelector(SWAYAM.weekItem, { timeout: SETTINGS.timeouts.element });

  const weekEls = await page.$$(SWAYAM.weekItem);
  const weeks: Week[] = [];
  let actualWeekIndex = 0; // index among real "Week XX" items only

  for (const weekEl of weekEls) {
    // Get the title from the h3 inside the toggle button
    const rawTitle = await weekEl
      .$eval(SWAYAM.weekTitle, (el) => el.textContent?.trim() ?? '')
      .catch(() => '');

    // Skip non-instructional sections (About NPTEL, How does it work?, Week 0, Books, etc.)
    // Only match actual instructional weeks: "Week 1", "Week 2", ...
    if (!/^week\s*[1-9]\d*/i.test(rawTitle)) {
      continue;
    }

    const weekTitle = rawTitle;
    const weekIdx = actualWeekIndex;
    actualWeekIndex++;

    // Find the toggle button and expand if collapsed
    const toggleBtn = await weekEl.$(SWAYAM.weekToggle);
    if (!toggleBtn) continue;

    const isExpanded = await toggleBtn.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await toggleBtn.click();
      await page.waitForTimeout(400);
    }

    // Get the aria-controls value to find the week list div (e.g., "unit-46-list")
    const ariaControls = await toggleBtn.getAttribute('aria-controls');
    if (!ariaControls) continue;

    // Collect all buttons inside the week list
    const lectureButtons = await page.$$(`#${ariaControls} ${SWAYAM.lectureItem}`);
    const lectures: Lecture[] = [];
    let lectureIdx = 0;

    for (const btn of lectureButtons) {
      let title = await btn
        .$eval(SWAYAM.lectureTitle, (el) => el.textContent?.trim() ?? '')
        .catch(() => '');

      if (!title) {
        title = (await btn.textContent())?.trim() ?? '';
      }
      title = title.replace(/\s+/g, ' ').trim();

      // Filter: ignore quizzes, feedback forms, download materials, introductory notes, and generic buttons
      const isNonLecture = /^(quiz|assignment|feedback|lecture material|reading material|reference|announcement|discussion|download|hall ticket|assessment|about|how does|welcome|information about|know your|what you should|certification|best practices|guidelines|mcq|numerical|subjective|programming|text transcripts|books|full screen|click here|manage exam|my bookmarks|bookmarks|q&a|accessibility|ai powered|week\s*\d+)/i.test(title);
      if (isNonLecture || !title || title.length < 3) {
        continue;
      }

      lectures.push({
        id: `w${weekIdx + 1}-l${lectureIdx + 1}-${slugify(title)}`,
        title,
        url: courseUrl,       // parent course URL — navigation is click-based
        weekIndex: weekIdx,
        lectureIndex: lectureIdx,
        youtubeUrl: null,
        transcriptPath: null,
        sync: {
          status: 'pending',
          method: null,
          notebooklmSourceTitle: null,
          syncedAt: null,
          error: null,
        },
      });
      lectureIdx++;
    }

    // Collapse week again to keep UI clean (optional)
    try {
      await toggleBtn.click();
      await page.waitForTimeout(200);
    } catch { /* ignore */ }

    weeks.push({
      id: `week-${weekIdx + 1}-${slugify(weekTitle)}`,
      title: weekTitle,
      lectures,
    });
  }

  const total = weeks.reduce((a, w) => a + w.lectures.length, 0);
  logger.info(`Found ${weeks.length} weeks with ${total} total lectures.`);

  return weeks;
}

// ── YouTube URL extraction ────────────────────────────────────

/**
 * Open the course page, click the correct week + lecture button,
 * and extract the embedded YouTube video URL.
 *
 * Priority:
 *  1. iframe[src*="youtube.com/embed"]  — standard embed
 *  2. div.ytmVideoCoverThumbnail background-image — YouTube mobile embed thumbnail
 */
export async function extractYoutubeLinkFromLecture(
  page: Page,
  courseUrl: string,
  weekIndex: number,
  lectureIndex: number,
): Promise<string | null> {
  logger.debug(`Navigating to course to open week ${weekIndex} / lecture ${lectureIndex}...`);
  await navigateTo(page, courseUrl);

  await page.waitForSelector(SWAYAM.weekItem, { timeout: SETTINGS.timeouts.element });

  // ── 1. Locate and expand the target week ─────────────────────
  const weekEls = await page.$$(SWAYAM.weekItem);
  let actualWeekIndex = 0;
  let targetToggle: import('playwright').ElementHandle<SVGElement | HTMLElement> | null = null;
  let targetAriaControls: string | null = null;

  for (const weekEl of weekEls) {
    const rawTitle = await weekEl
      .$eval(SWAYAM.weekTitle, (el) => el.textContent?.trim() ?? '')
      .catch(() => '');

    // Only match instructional weeks (Week 1, Week 2, ...)
    if (!/^week\s*[1-9]\d*/i.test(rawTitle)) continue;

    if (actualWeekIndex === weekIndex) {
      const toggle = await weekEl.$(SWAYAM.weekToggle);
      if (!toggle) break;

      const isExpanded = await toggle.getAttribute('aria-expanded');
      if (isExpanded !== 'true') {
        await toggle.click();
        await page.waitForTimeout(500);
      }

      targetAriaControls = await toggle.getAttribute('aria-controls');
      targetToggle = toggle;
      break;
    }
    actualWeekIndex++;
  }

  if (!targetAriaControls) {
    logger.warn(`Could not find week at index ${weekIndex}`);
    return null;
  }

  // ── 2. Click the target lecture button ───────────────────────
  const lectureButtons = await page.$$(`#${targetAriaControls} ${SWAYAM.lectureItem}`);
  const filteredLectures: typeof lectureButtons = [];
  for (const btn of lectureButtons) {
    let title = await btn
      .$eval(SWAYAM.lectureTitle, (el) => el.textContent?.trim() ?? '')
      .catch(() => '');
    if (!title) {
      title = (await btn.textContent())?.trim() ?? '';
    }
    title = title.replace(/\s+/g, ' ').trim();
    const isNonLecture = /^(quiz|assignment|feedback|lecture material|reading material|reference|announcement|discussion|download|hall ticket|assessment|about|how does|welcome|information about|know your|what you should|certification|best practices|guidelines|mcq|numerical|subjective|programming|text transcripts|books|full screen|click here|manage exam|my bookmarks|bookmarks|q&a|accessibility|ai powered|week\s*\d+)/i.test(title);
    if (!isNonLecture && title && title.length >= 3) {
      filteredLectures.push(btn);
    }
  }

  if (lectureIndex >= filteredLectures.length) {
    logger.warn(`Lecture index ${lectureIndex} out of bounds (found ${filteredLectures.length})`);
    return null;
  }

  await filteredLectures[lectureIndex].click();
  await page.waitForTimeout(2000); // wait for video to load

  // ── 3. Extract YouTube URL from the loaded video ─────────────

  // Attempt A: standard YouTube embed iframe in the main page
  try {
    await page.waitForSelector(SWAYAM.embeddedYoutubeIframe, { timeout: 5000 });
    const src = await page.getAttribute(SWAYAM.embeddedYoutubeIframe, 'src');
    if (src) {
      const match = src.match(/(?:embed\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (match) {
        logger.debug(`Extracted YouTube ID from iframe src: ${match[1]}`);
        return `https://www.youtube.com/watch?v=${match[1]}`;
      }
    }
  } catch { /* try next method */ }

  // Attempt B: YouTube mobile embed — thumbnail background-image inside iframe
  try {
    const iframeEl = await page.$(SWAYAM.embeddedYoutubeIframe);
    if (iframeEl) {
      const frame = await iframeEl.contentFrame();
      if (frame) {
        await frame.waitForSelector(SWAYAM.youtubeVideoThumbnail, { timeout: 5000 });
        const bgStyle = await frame.$eval(
          SWAYAM.youtubeVideoThumbnail,
          (el) => window.getComputedStyle(el).backgroundImage || el.getAttribute('style') || '',
        );
        const match = bgStyle.match(/ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})\//);
        if (match) {
          logger.debug(`Extracted YouTube ID from thumbnail: ${match[1]}`);
          return `https://www.youtube.com/watch?v=${match[1]}`;
        }
      }
    }
  } catch { /* failed */ }

  logger.warn(`Could not extract YouTube URL for week ${weekIndex} / lecture ${lectureIndex}`);
  return null;
}

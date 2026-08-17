// ============================================================
// src/cli/interactive.ts
// Interactive menu to select and run commands
// ============================================================

import inquirer from 'inquirer';
import chalk from 'chalk';
import { runInit } from './init.js';
import { runLogin } from './login.js';
import { runScan } from './scan.js';
import { runStatus } from './status.js';
import { runSyncLocal } from './sync-local.js';
import { runSyncNotebooklm } from './sync-notebooklm.js';
import { runSetMode } from './set-mode.js';
import { getAllCourses } from '../state/db.js';

export async function runInteractiveMenu(): Promise<void> {
  console.log(chalk.cyan.bold('\nWelcome to NPTEL → NotebookLM Sync!\n'));

  const { command } = await inquirer.prompt([
    {
      type: 'list',
      name: 'command',
      message: 'What would you like to do?',
      choices: [
        {
          name: '1. Scan Swayam for Enrolled Courses',
          value: 'scan',
          short: 'Scan',
        },
        {
          name: '2. Download Local Transcripts / Extract URLs',
          value: 'sync-local',
          short: 'Sync Local',
        },
        {
          name: '3. Upload Transcripts/URLs to NotebookLM',
          value: 'sync-notebooklm',
          short: 'Sync NotebookLM',
        },
        {
          name: '4. View Current Status of All Courses',
          value: 'status',
          short: 'Status',
        },
        {
          name: '5. Configure Sync Mode (Transcript vs URL)',
          value: 'set-mode',
          short: 'Set Mode',
        },
        {
          name: '6. Perform Initial Login (Swayam / Google)',
          value: 'login',
          short: 'Login',
        },
        {
          name: '7. Initialize Data Folders (Reset)',
          value: 'init',
          short: 'Init',
        },
        new inquirer.Separator(),
        {
          name: 'Exit',
          value: 'exit',
        },
      ],
    },
  ]);

  switch (command) {
    case 'scan':
      await runScan();
      break;
    case 'sync-local':
      await runSyncLocal();
      break;
    case 'sync-notebooklm':
      await runSyncNotebooklm();
      break;
    case 'status':
      await runStatus();
      break;
    case 'login':
      await runLogin();
      break;
    case 'init':
      await runInit();
      break;
    case 'set-mode':
      await handleSetModeInteractive();
      break;
    case 'exit':
      console.log(chalk.dim('\nGoodbye!\n'));
      process.exit(0);
  }
}

async function handleSetModeInteractive(): Promise<void> {
  const ObjectCourses = await getAllCourses();
  if (ObjectCourses.length === 0) {
    console.log(chalk.red('\nNo courses found. Please run "Scan" first.\n'));
    return;
  }

  const { courseIndex } = await inquirer.prompt([
    {
      type: 'list',
      name: 'courseIndex',
      message: 'Select a course to configure:',
      choices: ObjectCourses.map((c, i) => ({
        name: `[${i + 1}] ${c.title}`,
        value: i + 1,
      })),
    },
  ]);

  const { mode, notebookTitle } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Select sync mode:',
      choices: [
        { name: 'URL (Save YouTube link only)', value: 'url' },
        { name: 'Transcript (Download full lecture text)', value: 'transcript' },
      ],
    },
    {
      type: 'input',
      name: 'notebookTitle',
      message: 'Enter EXACT NotebookLM notebook title (leave blank for fuzzy matching with Course Title):',
    },
  ]);

  await runSetMode(String(courseIndex), mode, notebookTitle ? notebookTitle.trim() : undefined);
}

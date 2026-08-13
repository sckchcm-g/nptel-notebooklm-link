// ============================================================
// src/state/types.ts
// All shared TypeScript types for the entire project.
// ============================================================

export type SyncStatus = 'pending' | 'synced' | 'error' | 'skipped';
export type SyncMethod = 'url' | 'transcript';

export interface SyncRecord {
  status: SyncStatus;
  method: SyncMethod | null;
  notebooklmSourceTitle: string | null;
  syncedAt: string | null;
  error: string | null;
}

export interface Lecture {
  id: string;
  title: string;
  /**
   * For NPTEL: the parent course URL (lectures are buttons, not links).
   * Use weekIndex + lectureIndex to click the correct button.
   */
  url: string;
  /** 0-based index of this lecture's week in the sidebar nav (actual week items only). */
  weekIndex: number;
  /** 0-based index of this lecture within its week (lecture buttons only, not Quiz/Material). */
  lectureIndex: number;
  youtubeUrl: string | null;
  transcriptPath: string | null;
  sync: SyncRecord;
}

export interface Week {
  id: string;
  title: string;
  lectures: Lecture[];
}

export type SyncMode = 'transcript' | 'url';

export interface Course {
  id: string;
  title: string;
  url: string;
  syncMode: SyncMode;  // 'transcript' = extract & save text; 'url' = save YouTube URL only
  notebooklmNotebookId: string | null;
  weeks: Week[];
}

export interface AppState {
  version: string;
  lastScan: string | null;
  courses: Course[];
}

// ── CLI option types ──────────────────────────────────────────

export interface SyncOptions {
  course: string;
  week: string;
  lecture: string; // lecture number or 'all'
  method: SyncMethod;
}

export interface StatusOptions {
  course?: string;
  week?: string;
}

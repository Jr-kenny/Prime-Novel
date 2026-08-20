export type ReaderDatabaseState = {
  books: Array<{ id: string }>;
  activeId: string;
  preferences: unknown;
  bookmarks: Record<string, unknown>;
  positions: Record<string, unknown>;
};

export type AppDatabaseState = {
  history: Array<{ id: string; openedAt: number }>;
  readingSessions: Array<{ id: string; recordedAt: number }>;
  [key: string]: unknown;
};

export type DownloadDatabaseRecord = {
  key: string;
  downloadedAt: number;
};

export function loadReaderDatabaseState<T extends ReaderDatabaseState>(): T | undefined {
  return undefined;
}

export function persistReaderDatabaseState(_state: ReaderDatabaseState): void {}

export function loadAppDatabaseState<T extends AppDatabaseState>(): T | undefined {
  return undefined;
}

export function persistAppDatabaseState(_state: AppDatabaseState): void {}

export function loadDownloadDatabaseRecords<T extends DownloadDatabaseRecord>(): T[] | undefined {
  return undefined;
}

export function persistDownloadDatabaseRecords(_records: DownloadDatabaseRecord[]): void {}

export function upsertDownloadDatabaseRecord(_record: DownloadDatabaseRecord): void {}

export function deleteDownloadDatabaseRecord(_key: string): void {}

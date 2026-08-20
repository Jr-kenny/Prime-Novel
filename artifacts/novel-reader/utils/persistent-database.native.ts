import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import type { AppDatabaseState, DownloadDatabaseRecord, ReaderDatabaseState } from './persistent-database';

type JsonRow = { key: string; value: string };
type ValueRow = { value: string };

const database: SQLiteDatabase = openDatabaseSync('prime-novel.db');

function migrateDatabase() {
  const version = database.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  if (version >= 1) return;

  database.withTransactionSync(() => {
    database.execSync(`
      CREATE TABLE IF NOT EXISTS storage_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reader_books (id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS reader_positions (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS reader_bookmarks (book_id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS history_entries (id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, opened_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS history_entries_opened_at ON history_entries(opened_at DESC);
      CREATE TABLE IF NOT EXISTS reading_sessions (id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, recorded_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS reading_sessions_recorded_at ON reading_sessions(recorded_at DESC);
      CREATE TABLE IF NOT EXISTS download_entries (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, downloaded_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS download_entries_downloaded_at ON download_entries(downloaded_at DESC);
      CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      PRAGMA user_version = 1;
    `);
  });
}

migrateDatabase();

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function isReady(key: string) {
  return database.getFirstSync<ValueRow>('SELECT value FROM storage_meta WHERE key = ?', key)?.value === '1';
}

function loadJsonCache(table: string, keyColumn: string) {
  return new Map(database.getAllSync<JsonRow>(`SELECT ${keyColumn} AS key, value FROM ${table}`).map((row) => [row.key, row.value]));
}

const readerBooksCache = loadJsonCache('reader_books', 'id');
const readerPositionsCache = loadJsonCache('reader_positions', 'key');
const readerBookmarksCache = loadJsonCache('reader_bookmarks', 'book_id');
const historyCache = loadJsonCache('history_entries', 'id');
const readingSessionsCache = loadJsonCache('reading_sessions', 'id');
const downloadsCache = loadJsonCache('download_entries', 'key');

function syncJsonRows(
  table: 'reader_books' | 'reader_positions' | 'reader_bookmarks' | 'history_entries' | 'reading_sessions' | 'download_entries',
  keyColumn: 'id' | 'key' | 'book_id',
  orderColumn: 'updated_at' | 'opened_at' | 'recorded_at' | 'downloaded_at',
  rows: Array<{ key: string; value: unknown; order: number }>,
  cache: Map<string, string>,
) {
  const currentKeys = new Set(rows.map((row) => row.key));
  const removeStatement = database.prepareSync(`DELETE FROM ${table} WHERE ${keyColumn} = ?`);
  const upsertStatement = database.prepareSync(`INSERT OR REPLACE INTO ${table} (${keyColumn}, value, ${orderColumn}) VALUES (?, ?, ?)`);
  try {
    Array.from(cache.keys()).filter((key) => !currentKeys.has(key)).forEach((key) => {
      removeStatement.executeSync(key);
      cache.delete(key);
    });
    rows.forEach((row) => {
      const value = JSON.stringify(row.value);
      if (cache.get(row.key) === value) return;
      upsertStatement.executeSync(row.key, value, row.order);
      cache.set(row.key, value);
    });
  } finally {
    removeStatement.finalizeSync();
    upsertStatement.finalizeSync();
  }
}

export function loadReaderDatabaseState<T extends ReaderDatabaseState>(): T | undefined {
  if (!isReady('reader_ready')) return undefined;
  const values = new Map(database.getAllSync<JsonRow>('SELECT key, value FROM app_state WHERE key LIKE ?', 'reader:%').map((row) => [row.key, row.value]));
  const books = database.getAllSync<ValueRow>('SELECT value FROM reader_books ORDER BY updated_at DESC').map((row) => parseJson(row.value));
  const positions = Object.fromEntries(database.getAllSync<JsonRow>('SELECT key, value FROM reader_positions').map((row) => [row.key, parseJson(row.value)]));
  const bookmarks = Object.fromEntries(database.getAllSync<{ book_id: string; value: string }>('SELECT book_id, value FROM reader_bookmarks').map((row) => [row.book_id, parseJson(row.value)]));
  return {
    books,
    activeId: parseJson(values.get('reader:activeId') ?? '""'),
    preferences: parseJson(values.get('reader:preferences') ?? '{}'),
    bookmarks,
    positions,
  } as T;
}

export function persistReaderDatabaseState(state: ReaderDatabaseState): void {
  const now = Date.now();
  database.withTransactionSync(() => {
    syncJsonRows('reader_books', 'id', 'updated_at', state.books.map((book, index) => ({ key: book.id, value: book, order: now - index })), readerBooksCache);
    syncJsonRows('reader_positions', 'key', 'updated_at', Object.entries(state.positions).map(([key, value]) => ({ key, value, order: now })), readerPositionsCache);
    syncJsonRows('reader_bookmarks', 'book_id', 'updated_at', Object.entries(state.bookmarks).map(([key, value]) => ({ key, value, order: now })), readerBookmarksCache);
    database.runSync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', 'reader:activeId', JSON.stringify(state.activeId));
    database.runSync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', 'reader:preferences', JSON.stringify(state.preferences));
    database.runSync('INSERT OR REPLACE INTO storage_meta (key, value) VALUES (?, ?)', 'reader_ready', '1');
  });
}

export function loadAppDatabaseState<T extends AppDatabaseState>(): T | undefined {
  if (!isReady('app_ready')) return undefined;
  const stateRows = database.getAllSync<JsonRow>('SELECT key, value FROM app_state WHERE key LIKE ?', 'app:%');
  const state = Object.fromEntries(stateRows.map((row) => [row.key.slice(4), parseJson(row.value)]));
  const history = database.getAllSync<ValueRow>('SELECT value FROM history_entries ORDER BY opened_at DESC').map((row) => parseJson(row.value));
  const readingSessions = database.getAllSync<ValueRow>('SELECT value FROM reading_sessions ORDER BY recorded_at DESC').map((row) => parseJson(row.value));
  return { ...state, history, readingSessions } as T;
}

export function persistAppDatabaseState(state: AppDatabaseState): void {
  const { history, readingSessions, ...rest } = state;
  database.withTransactionSync(() => {
    syncJsonRows('history_entries', 'id', 'opened_at', history.map((entry) => ({ key: entry.id, value: entry, order: entry.openedAt })), historyCache);
    syncJsonRows('reading_sessions', 'id', 'recorded_at', readingSessions.map((entry) => ({ key: entry.id, value: entry, order: entry.recordedAt })), readingSessionsCache);
    database.execSync("DELETE FROM app_state WHERE key LIKE 'app:%'");
    const statement = database.prepareSync('INSERT INTO app_state (key, value) VALUES (?, ?)');
    try {
      Object.entries(rest).forEach(([key, value]) => statement.executeSync(`app:${key}`, JSON.stringify(value)));
    } finally {
      statement.finalizeSync();
    }
    database.runSync('INSERT OR REPLACE INTO storage_meta (key, value) VALUES (?, ?)', 'app_ready', '1');
  });
}

export function loadDownloadDatabaseRecords<T extends DownloadDatabaseRecord>(): T[] | undefined {
  if (!isReady('downloads_ready')) return undefined;
  return database.getAllSync<ValueRow>('SELECT value FROM download_entries ORDER BY downloaded_at DESC').map((row) => parseJson<T>(row.value));
}

export function persistDownloadDatabaseRecords(records: DownloadDatabaseRecord[]): void {
  database.withTransactionSync(() => {
    syncJsonRows('download_entries', 'key', 'downloaded_at', records.map((record) => ({ key: record.key, value: record, order: record.downloadedAt })), downloadsCache);
    database.runSync('INSERT OR REPLACE INTO storage_meta (key, value) VALUES (?, ?)', 'downloads_ready', '1');
  });
}

export function upsertDownloadDatabaseRecord(record: DownloadDatabaseRecord): void {
  const value = JSON.stringify(record);
  if (downloadsCache.get(record.key) === value) return;
  database.withTransactionSync(() => {
    database.runSync(
      'INSERT OR REPLACE INTO download_entries (key, value, downloaded_at) VALUES (?, ?, ?)',
      record.key,
      value,
      record.downloadedAt,
    );
    database.runSync('INSERT OR REPLACE INTO storage_meta (key, value) VALUES (?, ?)', 'downloads_ready', '1');
  });
  downloadsCache.set(record.key, value);
}

export function deleteDownloadDatabaseRecord(key: string): void {
  database.runSync('DELETE FROM download_entries WHERE key = ?', key);
  downloadsCache.delete(key);
}

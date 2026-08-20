import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Book, ReadingPosition, ReaderPreferences } from '@/context/ReaderContext';
import type { DownloadedChapter } from '@/context/CatalogContext';
import type { HistoryEntry, ReadingSession } from '@/context/AppContext';
import { PRIME_SOURCE_REGISTRY } from '@/data/prime-sources';

type ReaderBackup = {
  books: Book[];
  activeId: string;
  preferences: ReaderPreferences;
  bookmarks: Record<string, number[]>;
  positions: Record<string, ReadingPosition>;
};

type AppBackup = {
  history: HistoryEntry[];
  recentSearches: string[];
  readingSessions: ReadingSession[];
};

const protectedStorageKeys = [
  'novel-books',
  'novel-active',
  'novel-theme',
  'novel-preferences',
  'novel-bookmarks',
  'novel-positions',
  'prime-reader-backup-v1',
  'prime-settings',
  'prime-sources',
  'prime-repositories',
  'prime-available-sources',
  'prime-shared-links',
  'prime-history',
  'prime-recent-searches',
  'prime-reading-sessions',
  'prime-app-backup-v1',
  'prime-chapter-index-v2',
  'prime-chapter-index-backup-v2',
  'prime-chapter-cache',
];

export type RecoveryPreview = {
  currentBooks: number;
  recoverableBooks: number;
  currentHistory: number;
  recoverableHistory: number;
  currentDownloads: number;
  recoverableDownloads: number;
};

type RecoveryOptions = {
  includeFileBackups?: boolean;
};

function parseArray<T>(value: string | null): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function parseObject<T extends object>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : undefined;
  } catch {
    return undefined;
  }
}

async function readFileBackup<T>(name: string) {
  const { readPersistentBackup } = await import('@/utils/persistent-backup');
  return readPersistentBackup<T>(name);
}

function inferBookIdentity(bookId: string) {
  const source = PRIME_SOURCE_REGISTRY.find((item) => bookId.startsWith(`${item.id}:`));
  if (source) return { sourceId: source.id, sourceUrl: bookId.slice(source.id.length + 1) };
  const separator = bookId.indexOf(':');
  return separator > 0
    ? { sourceId: bookId.slice(0, separator), sourceUrl: bookId.slice(separator + 1) }
    : { sourceId: 'prime-catalog', sourceUrl: undefined };
}

function inferredTitle(bookId: string) {
  const { sourceUrl } = inferBookIdentity(bookId);
  if (!sourceUrl) return 'Recovered novel';
  try {
    const url = new URL(sourceUrl);
    const segment = url.pathname.split('/').filter(Boolean).at(-1) ?? url.hostname;
    return decodeURIComponent(segment).replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    return 'Recovered novel';
  }
}

function reconstructBooks(history: HistoryEntry[], downloads: DownloadedChapter[]) {
  const historyByBook = new Map<string, HistoryEntry[]>();
  history.forEach((entry) => historyByBook.set(entry.bookId, [...(historyByBook.get(entry.bookId) ?? []), entry]));
  const downloadsByBook = new Map<string, DownloadedChapter[]>();
  downloads.forEach((download) => downloadsByBook.set(download.novelId, [...(downloadsByBook.get(download.novelId) ?? []), download]));
  const ids = new Set([...historyByBook.keys(), ...downloadsByBook.keys()]);

  return Array.from(ids).map((bookId): Book => {
    const savedChapters = downloadsByBook.get(bookId) ?? [];
    const historyEntries = historyByBook.get(bookId) ?? [];
    const latestHistory = historyEntries.sort((left, right) => right.openedAt - left.openedAt)[0];
    const chapterNumbers = savedChapters.map((item) => item.chapter.number).filter(Number.isFinite);
    const chapter = Math.max(1, latestHistory?.chapter ?? Math.min(...chapterNumbers, 1));
    const totalChapters = Math.max(chapter, ...chapterNumbers, 1);
    const firstDownload = savedChapters[0];
    const identity = firstDownload
      ? { sourceId: firstDownload.sourceId, sourceUrl: inferBookIdentity(bookId).sourceUrl }
      : inferBookIdentity(bookId);
    return {
      id: bookId,
      title: firstDownload?.novelTitle || inferredTitle(bookId),
      author: 'Unknown author',
      cover: '',
      sourceId: identity.sourceId,
      sourceUrl: identity.sourceUrl,
      wordsPerChapter: 1200,
      chapter,
      totalChapters,
      progress: Math.min(100, Math.round(((chapter - 1) / Math.max(totalChapters, 1)) * 100)),
      status: 'Continue',
      lastRead: 'Recovered',
      genre: 'Novel',
      description: 'Recovered from reading history and offline download records.',
      readChapters: historyEntries.map((entry) => entry.chapter),
      chapters: savedChapters.map((item) => item.chapter).sort((left, right) => left.number - right.number),
    };
  });
}

async function recoveryData({ includeFileBackups = true }: RecoveryOptions = {}) {
  const entries = await AsyncStorage.multiGet([
    'novel-books',
    'prime-reader-backup-v1',
    'prime-history',
    'prime-app-backup-v1',
    'prime-chapter-index-v2',
    'prime-chapter-index-backup-v2',
    'prime-chapter-cache',
  ]);
  const preUpdateBackup = includeFileBackups ? await readFileBackup<Record<string, string>>('pre-update-storage') : undefined;
  const currentBooks = parseArray<Book>(entries[0][1]);
  const readerBackup = parseObject<ReaderBackup>(entries[1][1])
    ?? (includeFileBackups ? await readFileBackup<ReaderBackup>('reader-state') : undefined)
    ?? parseObject<ReaderBackup>(preUpdateBackup?.['prime-reader-backup-v1'] ?? null);
  const currentHistory = parseArray<HistoryEntry>(entries[2][1]);
  const appBackup = parseObject<AppBackup>(entries[3][1])
    ?? (includeFileBackups ? await readFileBackup<AppBackup>('app-state') : undefined)
    ?? parseObject<AppBackup>(preUpdateBackup?.['prime-app-backup-v1'] ?? null);
  const currentDownloads = parseArray<DownloadedChapter>(entries[4][1]);
  const downloadBackup = parseArray<DownloadedChapter>(entries[5][1]).length > 0
    ? parseArray<DownloadedChapter>(entries[5][1])
    : parseArray<DownloadedChapter>(preUpdateBackup?.['prime-chapter-index-backup-v2'] ?? null);
  const legacyDownloads = parseArray<DownloadedChapter>(entries[6][1]).length > 0
    ? parseArray<DownloadedChapter>(entries[6][1])
    : parseArray<DownloadedChapter>(preUpdateBackup?.['prime-chapter-cache'] ?? null);
  const preUpdateBooks = parseArray<Book>(preUpdateBackup?.['novel-books'] ?? null);
  const preUpdateHistory = parseArray<HistoryEntry>(preUpdateBackup?.['prime-history'] ?? null);
  const recoverableHistory = currentHistory.length > 0 ? currentHistory : appBackup?.history?.length ? appBackup.history : preUpdateHistory;
  const recoverableDownloads = currentDownloads.length > 0 ? currentDownloads : downloadBackup.length > 0 ? downloadBackup : legacyDownloads;
  const recoveredBooks = readerBackup?.books.length
    ? readerBackup.books
    : preUpdateBooks.length > 0
      ? preUpdateBooks
    : reconstructBooks(recoverableHistory, recoverableDownloads);
  const recoveredActiveId = readerBackup?.activeId || preUpdateBackup?.['novel-active'] || recoveredBooks[0]?.id || '';
  return { currentBooks, readerBackup, currentHistory, appBackup, currentDownloads, recoverableHistory, recoverableDownloads, recoveredBooks, recoveredActiveId };
}

export async function inspectRecoverableData(options?: RecoveryOptions): Promise<RecoveryPreview> {
  const data = await recoveryData(options);
  return {
    currentBooks: data.currentBooks.length,
    recoverableBooks: data.currentBooks.length > 0 ? 0 : data.recoveredBooks.length,
    currentHistory: data.currentHistory.length,
    recoverableHistory: data.currentHistory.length > 0 ? 0 : data.recoverableHistory.length,
    currentDownloads: data.currentDownloads.length,
    recoverableDownloads: data.currentDownloads.length > 0 ? 0 : data.recoverableDownloads.length,
  };
}

export async function createPreUpdateBackup() {
  const entries = await AsyncStorage.multiGet(protectedStorageKeys);
  const snapshot = Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== null));
  const { writePersistentBackup } = await import('@/utils/persistent-backup');
  await writePersistentBackup('pre-update-storage', snapshot);
}

export async function recoverSavedData(options?: RecoveryOptions): Promise<RecoveryPreview> {
  const data = await recoveryData(options);
  const writes: Array<[string, string]> = [];
  if (data.currentBooks.length === 0 && data.recoveredBooks.length > 0) {
    writes.push(['novel-books', JSON.stringify(data.recoveredBooks)]);
    writes.push(['novel-active', data.recoveredActiveId]);
    if (data.readerBackup) {
      writes.push(['novel-preferences', JSON.stringify(data.readerBackup.preferences)]);
      writes.push(['novel-bookmarks', JSON.stringify(data.readerBackup.bookmarks)]);
      writes.push(['novel-positions', JSON.stringify(data.readerBackup.positions)]);
    }
  }
  if (data.currentHistory.length === 0 && data.recoverableHistory.length > 0) {
    writes.push(['prime-history', JSON.stringify(data.recoverableHistory)]);
    if (data.appBackup?.recentSearches?.length) writes.push(['prime-recent-searches', JSON.stringify(data.appBackup.recentSearches)]);
    if (data.appBackup?.readingSessions?.length) writes.push(['prime-reading-sessions', JSON.stringify(data.appBackup.readingSessions)]);
  }
  if (data.currentDownloads.length === 0 && data.recoverableDownloads.length > 0) {
    writes.push(['prime-chapter-index-v2', JSON.stringify(data.recoverableDownloads.map(({ content: _content, ...download }) => download))]);
  }
  if (writes.length > 0) await AsyncStorage.multiSet(writes);
  return inspectRecoverableData(options);
}

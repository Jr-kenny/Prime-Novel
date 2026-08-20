import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Book } from '../context/ReaderContext';
import type { DownloadedChapter } from '../context/CatalogContext';
import type { HistoryEntry } from '../context/AppContext';

const values = new Map<string, string>();

Object.assign(AsyncStorage, {
  multiGet: async (keys: string[]) => keys.map((key) => [key, values.get(key) ?? null] as [string, string | null]),
  multiSet: async (entries: Array<[string, string]>) => entries.forEach(([key, value]) => values.set(key, value)),
  setItem: async (key: string, value: string) => values.set(key, value),
});

const existingBook: Book = {
  id: 'novel-bin:https://example.com/novel/kept-book',
  title: 'Kept Book',
  author: 'Saved Author',
  cover: '',
  sourceId: 'novel-bin',
  sourceUrl: 'https://example.com/novel/kept-book',
  wordsPerChapter: 1200,
  chapter: 8,
  totalChapters: 30,
  progress: 25,
  status: 'Continue',
  lastRead: 'Yesterday',
  genre: 'Fantasy',
  description: 'Existing saved book',
};

const history: HistoryEntry[] = [{
  id: `${existingBook.id}:8`,
  bookId: existingBook.id,
  chapter: 8,
  openedAt: 100,
}];

const download: DownloadedChapter = {
  key: 'novel-bin:chapter-8',
  sourceId: 'novel-bin',
  novelId: existingBook.id,
  novelTitle: existingBook.title,
  chapter: { id: 'chapter-8', number: 8, title: 'Chapter 8', url: 'https://example.com/novel/kept-book/8' },
  content: { chapter: { id: 'chapter-8', number: 8, title: 'Chapter 8', url: 'https://example.com/novel/kept-book/8' }, paragraphs: ['Saved offline'] },
  downloadedAt: 100,
};

async function main() {
  const { inspectRecoverableData, recoverSavedData } = await import('../utils/data-recovery');

  values.set('novel-books', JSON.stringify([existingBook]));
  values.set('prime-reader-backup-v1', JSON.stringify({ books: [], activeId: '', preferences: {}, bookmarks: {}, positions: {} }));
  values.set('prime-history', JSON.stringify(history));
  values.set('prime-app-backup-v1', JSON.stringify({ history, recentSearches: [], readingSessions: [] }));
  values.set('prime-chapter-cache', JSON.stringify([download]));

  let preview = await inspectRecoverableData({ includeFileBackups: false });
  assert.equal(preview.currentBooks, 1);
  assert.equal(preview.recoverableBooks, 0);
  assert.equal(preview.currentHistory, 1);
  assert.equal(preview.recoverableDownloads, 1);
  await recoverSavedData({ includeFileBackups: false });
  assert.deepEqual(JSON.parse(values.get('novel-books') ?? '[]'), [existingBook], 'recovery must not replace an existing library');
  assert.deepEqual(JSON.parse(values.get('prime-history') ?? '[]'), history, 'recovery must not replace existing history');
  assert.equal(JSON.parse(values.get('prime-chapter-index-v2') ?? '[]').length, 1, 'legacy downloads should be indexed');

  values.clear();
  values.set('novel-books', '[]');
  values.set('prime-reader-backup-v1', JSON.stringify({ books: [], activeId: '', preferences: {}, bookmarks: {}, positions: {} }));
  values.set('prime-history', JSON.stringify(history));
  values.set('prime-app-backup-v1', JSON.stringify({ history, recentSearches: [], readingSessions: [] }));
  values.set('prime-chapter-cache', JSON.stringify([download]));

  preview = await inspectRecoverableData({ includeFileBackups: false });
  assert.equal(preview.currentBooks, 0);
  assert.equal(preview.recoverableBooks, 1);
  await recoverSavedData({ includeFileBackups: false });
  const recoveredBooks = JSON.parse(values.get('novel-books') ?? '[]') as Book[];
  assert.equal(recoveredBooks.length, 1);
  assert.equal(recoveredBooks[0].id, existingBook.id);
  assert.equal(recoveredBooks[0].title, existingBook.title);
  assert.equal(recoveredBooks[0].chapter, 8);
  assert.equal(JSON.parse(values.get('prime-history') ?? '[]').length, 1);

  console.log('Prime Novel storage recovery regression checks passed.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

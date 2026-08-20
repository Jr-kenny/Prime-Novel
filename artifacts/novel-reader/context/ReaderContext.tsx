import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

export type BookStatus = 'New chapters' | 'Continue' | 'On hold' | 'Plan to read' | 'Completed';
export type ReaderTheme = 'paper' | 'soft-dark' | 'black' | 'white';
export type ReaderMode = 'vertical' | 'horizontal';
export type ReaderFont = 'serif' | 'sans' | 'merriweather' | 'atkinson';

export type ReaderPreferences = {
  textSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  paragraphIndent: boolean;
  margins: number;
  font: ReaderFont;
  theme: ReaderTheme;
  fullscreen: boolean;
  keepScreenAwake: boolean;
  lockRotation: boolean;
  mode: ReaderMode;
};

export type ReadingPosition = {
  chapter: number;
  verticalOffset: number;
  pageIndex: number;
  chapterProgress: number;
};

export type BookChapter = {
  id: string;
  number: number;
  title: string;
  url: string;
  releaseDate?: string;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  cover: number | string;
  sourceId: string;
  wordsPerChapter: number;
  chapter: number;
  totalChapters: number;
  progress: number;
  status: BookStatus;
  lastRead: string;
  newChapters?: number;
  favorite?: boolean;
  genre: string;
  description: string;
  readChapters?: number[];
  sourceUrl?: string;
  chapters?: BookChapter[];
};

type ReaderContextValue = {
  books: Book[];
  activeBook?: Book;
  readerTheme: ReaderTheme;
  readerPreferences: ReaderPreferences;
  setReaderTheme: (theme: ReaderTheme) => void;
  updateReaderPreferences: (changes: Partial<ReaderPreferences>) => void;
  advanceReading: () => number | null;
  setActiveChapter: (chapter: number, bookId?: string) => void;
  markChapterRead: (chapter?: number) => void;
  markChapterUnread: (chapter?: number) => void;
  markChaptersRead: (chapters: number[]) => void;
  markChaptersUnread: (chapters: number[]) => void;
  isChapterRead: (chapter?: number) => boolean;
  toggleFavorite: (id: string) => void;
  removeBook: (id: string) => void;
  setActiveBook: (id: string) => void;
  upsertBook: (book: Book) => void;
  bookmarks: Record<string, number[]>;
  addBookmark: (chapter?: number, bookId?: string) => void;
  removeBookmark: (chapter?: number, bookId?: string) => void;
  isChapterBookmarked: (chapter?: number, bookId?: string) => boolean;
  getReadingPosition: (bookId?: string, chapter?: number) => ReadingPosition;
  saveReadingPosition: (position: Partial<ReadingPosition>, bookId?: string) => void;
  hydrated: boolean;
};

const defaultReaderPreferences: ReaderPreferences = {
  textSize: 20,
  lineHeight: 34,
  paragraphSpacing: 22,
  paragraphIndent: false,
  margins: 28,
  font: 'serif',
  theme: 'paper',
  fullscreen: false,
  keepScreenAwake: false,
  lockRotation: false,
  mode: 'vertical',
};

type StorageSnapshot = {
  books: Book[];
  activeId: string;
  preferences: ReaderPreferences;
  bookmarks: Record<string, number[]>;
  positions: Record<string, ReadingPosition>;
};

const initialSnapshot: StorageSnapshot = {
  books: [],
  activeId: '',
  preferences: defaultReaderPreferences,
  bookmarks: {},
  positions: {},
};

function normalizeBookmarks(value: Record<string, number[]> | number[] | null, activeId: string) {
  if (Array.isArray(value)) {
    return activeId && value.length > 0 ? { [activeId]: Array.from(new Set(value.filter((chapter) => Number.isInteger(chapter)))) } : {};
  }
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).map(([bookId, chapters]) => [
      bookId,
      Array.from(new Set((Array.isArray(chapters) ? chapters : []).filter((chapter) => Number.isInteger(chapter)))),
    ]),
  );
}

function readJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeBooks(books: Book[]) {
  return books.map((book) => ({
    ...book,
    sourceId: book.sourceId ?? 'prime-catalog',
    wordsPerChapter: book.wordsPerChapter ?? 154,
    readChapters: book.readChapters ?? [],
  }));
}

function clampChapterProgress(value: number | undefined) {
  return Math.max(0, Math.min(1, value ?? 0));
}

function bookProgressForPosition(book: Book, chapter: number, chapterProgress: number) {
  const totalChapters = Math.max(book.totalChapters, 1);
  const completedChapters = Math.max(0, Math.min(totalChapters, chapter - 1));
  return Math.min(100, Math.round(((completedChapters + clampChapterProgress(chapterProgress)) / totalChapters) * 100));
}

function positionForBook(book: Book | undefined, position?: ReadingPosition): ReadingPosition {
  return {
    chapter: position?.chapter ?? book?.chapter ?? 1,
    verticalOffset: Math.max(0, position?.verticalOffset ?? 0),
    pageIndex: Math.max(0, position?.pageIndex ?? 0),
    chapterProgress: clampChapterProgress(position?.chapterProgress),
  };
}

function chapterPositionKey(bookId: string, chapter: number) {
  return `${bookId}:${chapter}`;
}

function positionForChapter(book: Book | undefined, positions: Record<string, ReadingPosition>, chapter: number): ReadingPosition {
  const chapterPosition = book ? positions[chapterPositionKey(book.id, chapter)] : undefined;
  if (chapterPosition) return positionForBook(book, chapterPosition);

  const legacyPosition = book ? positions[book.id] : undefined;
  if (legacyPosition?.chapter === chapter) return positionForBook(book, legacyPosition);

  return positionForBook(book, { chapter, verticalOffset: 0, pageIndex: 0, chapterProgress: 0 });
}

const ReaderContext = createContext<ReaderContextValue | null>(null);

export function ReaderProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [activeId, setActiveId] = useState('');
  const [readerPreferences, setReaderPreferences] = useState<ReaderPreferences>(defaultReaderPreferences);
  const [bookmarks, setBookmarks] = useState<Record<string, number[]>>({});
  const [readingPositions, setReadingPositions] = useState<Record<string, ReadingPosition>>({});
  const [hydrated, setHydrated] = useState(false);
  const snapshotRef = useRef<StorageSnapshot>(initialSnapshot);
  const storageWriteRef = useRef<Promise<void>>(Promise.resolve());
  const storageWriteRevisionRef = useRef(0);

  useEffect(() => {
    AsyncStorage.multiGet([
      'novel-books',
      'novel-active',
      'novel-theme',
      'novel-preferences',
      'novel-bookmarks',
      'novel-positions',
    ])
      .then((entries) => {
        const storedPositions = readJson<Record<string, ReadingPosition>>(entries[5][1], {});
        const storedBooks = normalizeBooks(readJson<Book[]>(entries[0][1], [])).map((book) => {
          const latestPosition = storedPositions[book.id];
          const latestChapter = latestPosition?.chapter;
          return Number.isInteger(latestChapter) && latestChapter >= 1 && latestChapter <= book.totalChapters
            ? { ...book, chapter: latestChapter }
            : book;
        });
        const requestedActive = entries[1][1] ?? initialSnapshot.activeId;
        const storedActive = storedBooks.some((book) => book.id === requestedActive) ? requestedActive : storedBooks[0]?.id ?? '';
        const storedTheme = readJson<ReaderTheme | null>(entries[2][1], null);
        const storedPreferences = readJson<Partial<ReaderPreferences> | null>(entries[3][1], null);
        const storedBookmarks = normalizeBookmarks(
          readJson<Record<string, number[]> | number[] | null>(entries[4][1], null),
          storedActive,
        );
        const nextPreferences: ReaderPreferences = {
          ...defaultReaderPreferences,
          ...(storedTheme ? { theme: storedTheme } : {}),
          ...(storedPreferences ?? {}),
        };
        if (
          storedPreferences?.textSize === 18 &&
          storedPreferences?.lineHeight === 31 &&
          storedPreferences?.paragraphSpacing === 20
        ) {
          nextPreferences.textSize = defaultReaderPreferences.textSize;
          nextPreferences.lineHeight = defaultReaderPreferences.lineHeight;
          nextPreferences.paragraphSpacing = defaultReaderPreferences.paragraphSpacing;
        }
        const nextSnapshot: StorageSnapshot = {
          books: storedBooks,
          activeId: storedActive,
          preferences: nextPreferences,
          bookmarks: storedBookmarks,
          positions: storedPositions,
        };

        snapshotRef.current = nextSnapshot;
        setBooks(storedBooks);
        setActiveId(storedActive);
        setReaderPreferences(nextPreferences);
        setBookmarks(storedBookmarks);
        setReadingPositions(storedPositions);
      })
      .finally(() => setHydrated(true));
  }, []);

  const writeSnapshot = (changes: Partial<StorageSnapshot>) => {
    const nextSnapshot = { ...snapshotRef.current, ...changes };
    snapshotRef.current = nextSnapshot;
    const revision = storageWriteRevisionRef.current + 1;
    storageWriteRevisionRef.current = revision;
    storageWriteRef.current = storageWriteRef.current
      .catch(() => {})
      .then(async () => {
        if (revision !== storageWriteRevisionRef.current) return;
        await AsyncStorage.multiSet([
          ['novel-books', JSON.stringify(nextSnapshot.books)],
          ['novel-active', nextSnapshot.activeId],
          ['novel-theme', nextSnapshot.preferences.theme],
          ['novel-preferences', JSON.stringify(nextSnapshot.preferences)],
          ['novel-bookmarks', JSON.stringify(nextSnapshot.bookmarks)],
          ['novel-positions', JSON.stringify(nextSnapshot.positions)],
        ]);
      });
  };

  const updateReaderPreferences = (changes: Partial<ReaderPreferences>) => {
    const nextPreferences = { ...snapshotRef.current.preferences, ...changes };
    setReaderPreferences(nextPreferences);
    writeSnapshot({ preferences: nextPreferences });
  };

  const setReaderTheme = (theme: ReaderTheme) => {
    updateReaderPreferences({ theme });
  };

  const setActiveBook = (id: string) => {
    if (!snapshotRef.current.books.some((book) => book.id === id)) return;
    setActiveId(id);
    writeSnapshot({ activeId: id });
  };

  const upsertBook = (book: Book) => {
    const existing = snapshotRef.current.books.find((item) => item.id === book.id);
    const nextBook: Book = existing
      ? {
          ...book,
          chapter: existing.chapter,
          progress: existing.progress,
          status: existing.status,
          lastRead: existing.lastRead,
          favorite: existing.favorite,
          readChapters: existing.readChapters,
        }
      : book;
    const nextBooks = [nextBook, ...snapshotRef.current.books.filter((item) => item.id !== book.id)];
    setBooks(nextBooks);
    setActiveId(book.id);
    writeSnapshot({ books: nextBooks, activeId: book.id });
  };

  const setActiveChapter = (chapter: number, bookId = snapshotRef.current.activeId) => {
    const currentBook = snapshotRef.current.books.find((book) => book.id === bookId);
    if (!currentBook || chapter < 1 || chapter > currentBook.totalChapters) return;

    const nextBooks = snapshotRef.current.books.map((book) => {
      if (book.id !== bookId) return book;
      return {
        ...book,
        chapter,
        progress: Math.max(book.progress, bookProgressForPosition(book, chapter, positionForChapter(book, snapshotRef.current.positions, chapter).chapterProgress)),
        lastRead: 'Just now',
        status: book.status === 'New chapters' ? ('Continue' as BookStatus) : book.status,
      };
    });
    setActiveId(bookId);
    setBooks(nextBooks);
    writeSnapshot({ activeId: bookId, books: nextBooks });
  };

  const advanceReading = () => {
    const currentBook = snapshotRef.current.books.find((book) => book.id === snapshotRef.current.activeId);
    if (!currentBook) return null;

    if (currentBook.chapter >= currentBook.totalChapters) {
      const nextBooks = snapshotRef.current.books.map((book) =>
        book.id === currentBook.id
          ? {
              ...book,
              status: 'Completed' as BookStatus,
              progress: 100,
              readChapters: Array.from(new Set([...(book.readChapters ?? []), currentBook.chapter])),
              lastRead: 'Just now',
            }
          : book,
      );
      setBooks(nextBooks);
      writeSnapshot({ books: nextBooks });
      return null;
    }

    const nextChapter = currentBook.chapter + 1;
    const nextBooks = snapshotRef.current.books.map((book) =>
      book.id === currentBook.id
        ? {
            ...book,
            chapter: nextChapter,
            progress: Math.max(book.progress, bookProgressForPosition(book, nextChapter, 0)),
            lastRead: 'Just now',
            status: book.status === 'New chapters' ? 'Continue' : book.status,
            readChapters: Array.from(new Set([...(book.readChapters ?? []), currentBook.chapter])),
          }
        : book,
    );
    const nextPositions = {
      ...snapshotRef.current.positions,
      [chapterPositionKey(currentBook.id, nextChapter)]: { chapter: nextChapter, verticalOffset: 0, pageIndex: 0, chapterProgress: 0 },
      [currentBook.id]: { chapter: nextChapter, verticalOffset: 0, pageIndex: 0, chapterProgress: 0 },
    };
    setBooks(nextBooks);
    setReadingPositions(nextPositions);
    writeSnapshot({ books: nextBooks, positions: nextPositions });
    return nextChapter;
  };

  const markChaptersRead = (chapters: number[]) => {
    const uniqueChapters = Array.from(new Set(chapters.filter((chapter) => Number.isInteger(chapter) && chapter > 0)));
    if (uniqueChapters.length === 0) return;
    const activeBook = snapshotRef.current.books.find((book) => book.id === snapshotRef.current.activeId);
    if (!activeBook) return;
    const nextPositions = {
      ...snapshotRef.current.positions,
      ...Object.fromEntries(uniqueChapters.map((chapter) => [
        chapterPositionKey(activeBook.id, chapter),
        { ...positionForChapter(activeBook, snapshotRef.current.positions, chapter), chapterProgress: 1 },
      ])),
    };
    const nextBooks = snapshotRef.current.books.map((book) => {
      if (book.id !== snapshotRef.current.activeId) return book;
      return {
        ...book,
        progress: Math.max(book.progress, ...uniqueChapters.map((chapter) => bookProgressForPosition(book, chapter, 1))),
        readChapters: Array.from(new Set([...(book.readChapters ?? []), ...uniqueChapters])).sort((left, right) => left - right),
        status: uniqueChapters.some((chapter) => chapter >= book.totalChapters) ? ('Completed' as BookStatus) : book.status,
      };
    });
    setBooks(nextBooks);
    setReadingPositions(nextPositions);
    writeSnapshot({ books: nextBooks, positions: nextPositions });
  };

  const markChapterRead = (chapter = snapshotRef.current.books.find((book) => book.id === snapshotRef.current.activeId)?.chapter) => {
    if (chapter) markChaptersRead([chapter]);
  };

  const markChaptersUnread = (chapters: number[]) => {
    const uniqueChapters = new Set(chapters.filter((chapter) => Number.isInteger(chapter) && chapter > 0));
    if (uniqueChapters.size === 0) return;
    const nextBooks = snapshotRef.current.books.map((book) => {
      if (book.id !== snapshotRef.current.activeId) return book;
      return {
        ...book,
        readChapters: (book.readChapters ?? []).filter((readChapter) => !uniqueChapters.has(readChapter)),
        status: book.status === 'Completed' ? 'Continue' : book.status,
      };
    });
    setBooks(nextBooks);
    writeSnapshot({ books: nextBooks });
  };

  const markChapterUnread = (chapter = snapshotRef.current.books.find((book) => book.id === snapshotRef.current.activeId)?.chapter) => {
    if (chapter) markChaptersUnread([chapter]);
  };

  const isChapterRead = (chapter = snapshotRef.current.books.find((book) => book.id === snapshotRef.current.activeId)?.chapter) => {
    const book = snapshotRef.current.books.find((item) => item.id === snapshotRef.current.activeId);
    return chapter ? book?.readChapters?.includes(chapter) ?? false : false;
  };

  const toggleFavorite = (id: string) => {
    const nextBooks = snapshotRef.current.books.map((book) => (book.id === id ? { ...book, favorite: !book.favorite } : book));
    setBooks(nextBooks);
    writeSnapshot({ books: nextBooks });
  };

  const removeBook = (id: string) => {
    const nextBooks = snapshotRef.current.books.filter((book) => book.id !== id);
    const nextActiveId = snapshotRef.current.activeId === id ? nextBooks[0]?.id ?? '' : snapshotRef.current.activeId;
    const nextPositions = Object.fromEntries(
      Object.entries(snapshotRef.current.positions).filter(([key]) => key !== id && !key.startsWith(`${id}:`)),
    );
    const nextBookmarks = Object.fromEntries(Object.entries(snapshotRef.current.bookmarks).filter(([bookId]) => bookId !== id));
    setBooks(nextBooks);
    setActiveId(nextActiveId);
    setReadingPositions(nextPositions);
    setBookmarks(nextBookmarks);
    writeSnapshot({ books: nextBooks, activeId: nextActiveId, positions: nextPositions, bookmarks: nextBookmarks });
  };

  const addBookmark = (
    chapter = snapshotRef.current.books.find((book) => book.id === snapshotRef.current.activeId)?.chapter ?? 1,
    bookId = snapshotRef.current.activeId,
  ) => {
    if (!bookId) return;
    const currentBookmarks = snapshotRef.current.bookmarks[bookId] ?? [];
    if (currentBookmarks.includes(chapter)) return;
    const nextBookmarks = {
      ...snapshotRef.current.bookmarks,
      [bookId]: [...currentBookmarks, chapter].sort((left, right) => left - right),
    };
    setBookmarks(nextBookmarks);
    writeSnapshot({ bookmarks: nextBookmarks });
  };

  const removeBookmark = (
    chapter = snapshotRef.current.books.find((book) => book.id === snapshotRef.current.activeId)?.chapter ?? 1,
    bookId = snapshotRef.current.activeId,
  ) => {
    if (!bookId) return;
    const currentBookmarks = snapshotRef.current.bookmarks[bookId] ?? [];
    const nextBookmarks = {
      ...snapshotRef.current.bookmarks,
      [bookId]: currentBookmarks.filter((item) => item !== chapter),
    };
    setBookmarks(nextBookmarks);
    writeSnapshot({ bookmarks: nextBookmarks });
  };

  const isChapterBookmarked = (
    chapter = snapshotRef.current.books.find((book) => book.id === snapshotRef.current.activeId)?.chapter,
    bookId = snapshotRef.current.activeId,
  ) => Boolean(chapter && snapshotRef.current.bookmarks[bookId]?.includes(chapter));

  const getReadingPosition = (bookId = snapshotRef.current.activeId, chapter?: number) => {
    const book = snapshotRef.current.books.find((item) => item.id === bookId);
    return positionForChapter(book, snapshotRef.current.positions, chapter ?? book?.chapter ?? 1);
  };

  const saveReadingPosition = (position: Partial<ReadingPosition>, bookId = snapshotRef.current.activeId) => {
    const book = snapshotRef.current.books.find((item) => item.id === bookId);
    const chapter = position.chapter ?? book?.chapter ?? 1;
    const nextPosition = {
      ...positionForChapter(book, snapshotRef.current.positions, chapter),
      ...position,
      chapter,
      chapterProgress: clampChapterProgress(position.chapterProgress ?? positionForChapter(book, snapshotRef.current.positions, chapter).chapterProgress),
    };
    const nextPositions = {
      ...snapshotRef.current.positions,
      [chapterPositionKey(bookId, chapter)]: nextPosition,
      [bookId]: nextPosition,
    };
    const nextBooks = book
      ? snapshotRef.current.books.map((item) => item.id === bookId
        ? {
            ...item,
            chapter,
            progress: Math.max(item.progress, bookProgressForPosition(item, chapter, nextPosition.chapterProgress)),
            lastRead: 'Just now',
            status: item.status === 'New chapters' ? ('Continue' as BookStatus) : item.status,
          }
        : item)
      : snapshotRef.current.books;
    setBooks(nextBooks);
    if (book) setActiveId(bookId);
    setReadingPositions(nextPositions);
    writeSnapshot({ books: nextBooks, activeId: book ? bookId : snapshotRef.current.activeId, positions: nextPositions });
  };

  const activeBook = books.find((book) => book.id === activeId) ?? books[0];

  return (
    <ReaderContext.Provider
      value={{
        books,
        activeBook,
        readerTheme: readerPreferences.theme,
        readerPreferences,
        setReaderTheme,
        updateReaderPreferences,
        advanceReading,
        setActiveChapter,
        markChapterRead,
        markChapterUnread,
        markChaptersRead,
        markChaptersUnread,
        isChapterRead,
        toggleFavorite,
        removeBook,
        setActiveBook,
        upsertBook,
        bookmarks,
        addBookmark,
        removeBookmark,
        isChapterBookmarked,
        getReadingPosition,
        saveReadingPosition,
        hydrated,
      }}
    >
      {children}
    </ReaderContext.Provider>
  );
}

export function useReader() {
  const context = useContext(ReaderContext);
  if (!context) throw new Error('useReader must be used inside ReaderProvider');
  return context;
}

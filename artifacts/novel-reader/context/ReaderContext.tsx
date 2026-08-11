import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type BookStatus = 'New chapters' | 'Continue' | 'On hold' | 'Plan to read' | 'Completed';
export type ReaderTheme = 'paper' | 'soft-dark' | 'black';

export type Book = {
  id: string;
  title: string;
  author: string;
  cover: number;
  chapter: number;
  totalChapters: number;
  progress: number;
  status: BookStatus;
  lastRead: string;
  newChapters?: number;
  favorite?: boolean;
  genre: string;
  description: string;
};

type ReaderContextValue = {
  books: Book[];
  activeBook: Book;
  readerTheme: ReaderTheme;
  setReaderTheme: (theme: ReaderTheme) => void;
  advanceReading: () => void;
  toggleFavorite: (id: string) => void;
  setActiveBook: (id: string) => void;
  bookmarks: number[];
  addBookmark: () => void;
  hydrated: boolean;
};

const lighthouse = require('@/assets/images/cover-lighthouse.jpg');
const greenhouse = require('@/assets/images/cover-greenhouse.jpg');
const observatory = require('@/assets/images/cover-observatory.jpg');

const seedBooks: Book[] = [
  {
    id: 'salt-lighthouse',
    title: 'The Salt Lighthouse',
    author: 'Mara Venn',
    cover: lighthouse,
    chapter: 142,
    totalChapters: 210,
    progress: 68,
    status: 'Continue',
    lastRead: '12 min ago',
    favorite: true,
    genre: 'Literary fantasy',
    description: 'Every night, the lighthouse keeper lights a lamp for ships that have not yet been built.',
  },
  {
    id: 'glass-house',
    title: 'A House Made of Glass',
    author: 'Elian Rook',
    cover: greenhouse,
    chapter: 38,
    totalChapters: 96,
    progress: 39,
    status: 'New chapters',
    lastRead: 'Yesterday',
    newChapters: 3,
    genre: 'Romance',
    description: 'Two people, one greenhouse, and a summer that refuses to end.',
  },
  {
    id: 'observatory',
    title: 'The Quiet Observatory',
    author: 'N. Aris',
    cover: observatory,
    chapter: 12,
    totalChapters: 54,
    progress: 22,
    status: 'On hold',
    lastRead: '3 months ago',
    genre: 'Science fiction',
    description: 'At the edge of a salt plain, someone has built a window into tomorrow.',
  },
];

const ReaderContext = createContext<ReaderContextValue | null>(null);

export function ReaderProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<Book[]>(seedBooks);
  const [activeId, setActiveId] = useState('salt-lighthouse');
  const [readerTheme, setReaderThemeState] = useState<ReaderTheme>('paper');
  const [bookmarks, setBookmarks] = useState<number[]>([67, 104]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet(['novel-books', 'novel-active', 'novel-theme', 'novel-bookmarks'])
      .then((entries) => {
        const storedBooks = entries[0][1];
        const storedActive = entries[1][1];
        const storedTheme = entries[2][1] as ReaderTheme | null;
        const storedBookmarks = entries[3][1];
        if (storedBooks) setBooks(JSON.parse(storedBooks));
        if (storedActive) setActiveId(storedActive);
        if (storedTheme) setReaderThemeState(storedTheme);
        if (storedBookmarks) setBookmarks(JSON.parse(storedBookmarks));
      })
      .finally(() => setHydrated(true));
  }, []);

  const persist = (nextBooks: Book[], nextActive = activeId, nextTheme = readerTheme, nextBookmarks = bookmarks) => {
    AsyncStorage.multiSet([
      ['novel-books', JSON.stringify(nextBooks)],
      ['novel-active', nextActive],
      ['novel-theme', nextTheme],
      ['novel-bookmarks', JSON.stringify(nextBookmarks)],
    ]);
  };

  const setActiveBook = (id: string) => {
    setActiveId(id);
    persist(books, id);
  };

  const advanceReading = () => {
    const nextBooks = books.map((book) =>
      book.id === activeId
        ? { ...book, chapter: Math.min(book.chapter + 1, book.totalChapters), progress: Math.min(book.progress + 1, 100), lastRead: 'Just now' }
        : book,
    );
    setBooks(nextBooks);
    persist(nextBooks);
  };

  const toggleFavorite = (id: string) => {
    const nextBooks = books.map((book) => (book.id === id ? { ...book, favorite: !book.favorite } : book));
    setBooks(nextBooks);
    persist(nextBooks);
  };

  const setReaderTheme = (theme: ReaderTheme) => {
    setReaderThemeState(theme);
    persist(books, activeId, theme);
  };

  const addBookmark = () => {
    const nextBookmarks = [...bookmarks, 142];
    setBookmarks(nextBookmarks);
    persist(books, activeId, readerTheme, nextBookmarks);
  };

  const value = useMemo(() => ({
    books,
    activeBook: books.find((book) => book.id === activeId) ?? books[0],
    readerTheme,
    setReaderTheme,
    advanceReading,
    toggleFavorite,
    setActiveBook,
    bookmarks,
    addBookmark,
    hydrated,
  }), [books, activeId, readerTheme, bookmarks, hydrated]);

  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
}

export function useReader() {
  const context = useContext(ReaderContext);
  if (!context) throw new Error('useReader must be used inside ReaderProvider');
  return context;
}
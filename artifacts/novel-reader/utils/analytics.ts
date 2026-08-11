import type { Book } from '@/context/ReaderContext';

export function readChapterCount(book: Book) {
  if (book.status === 'Completed') return book.totalChapters;
  return Math.min(book.totalChapters, Math.max(book.readChapters?.length ?? 0, Math.max(0, book.chapter - 1)));
}

export function unreadChapterCount(book: Book) {
  return Math.max(0, book.totalChapters - readChapterCount(book));
}

export function isReadingBook(book: Book) {
  return book.status === 'Continue' || (readChapterCount(book) > 0 && book.status !== 'Completed');
}

export function wordsReadForBook(book: Book) {
  return readChapterCount(book) * (book.wordsPerChapter ?? 0);
}

export function sourceIdForBook(book: Book) {
  return book.sourceId ?? 'prime-catalog';
}

export function formatReadingTime(durationMs: number) {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60_000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatCount(value: number) {
  return new Intl.NumberFormat('en-US', { notation: value >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}

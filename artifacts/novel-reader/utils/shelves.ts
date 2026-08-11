import { Book } from '@/context/ReaderContext';

function ageInMinutes(lastRead: string) {
  const minutes = lastRead.match(/(\d+)\s+min/);
  if (minutes) return Number(minutes[1]);
  if (lastRead.toLowerCase().includes('yesterday')) return 24 * 60;
  if (lastRead.toLowerCase().includes('month')) return 30 * 24 * 60;
  return 7 * 24 * 60;
}

function isStarted(book: Book) {
  return book.progress > 0 && book.status !== 'Plan to read';
}

export function splitShelfBooks(books: Book[]) {
  const ranked = [...books].sort((left, right) => {
    const progressDifference = right.progress - left.progress;
    if (progressDifference !== 0) return progressDifference;
    return ageInMinutes(left.lastRead) - ageInMinutes(right.lastRead);
  });
  const started = ranked.filter(isStarted);
  const priority = started.slice(0, 3);
  const priorityIds = new Set(priority.map((book) => book.id));

  return {
    priorityBooks: priority,
    otherBooks: ranked.filter((book) => !priorityIds.has(book.id)),
  };
}

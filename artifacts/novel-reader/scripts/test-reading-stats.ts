import {
  localDayKey,
  recordChaptersRead,
  recordReadingSession,
  recordReadingTime,
  statsForDay,
  type ReadingStatsSnapshot,
} from '../utils/reading-stats.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const day = localDayKey();
let snapshot: ReadingStatsSnapshot = { days: [], novels: [] };

snapshot = recordReadingSession(snapshot, { bookId: 'book-1', bookTitle: 'Sample' });
assert(statsForDay(snapshot, day).sessions === 1, 'session visit is counted');

snapshot = recordReadingTime(snapshot, { bookId: 'book-1', bookTitle: 'Sample', durationMs: 120_000 });
assert(statsForDay(snapshot, day).readingTimeMs === 120_000, 'reading time accumulates for the day');

snapshot = recordReadingTime(snapshot, { bookId: 'book-1', bookTitle: 'Sample', durationMs: 60_000 });
assert(statsForDay(snapshot, day).readingTimeMs === 180_000, 'time continues to accumulate');

snapshot = recordChaptersRead(snapshot, { bookId: 'book-1', bookTitle: 'Sample', chapterCount: 3 });
assert(statsForDay(snapshot, day).chaptersRead === 3, 'chapters read are tracked');

snapshot = recordReadingSession(snapshot, { bookId: 'book-2', bookTitle: 'Other', day: '2026-09-27' });
assert(statsForDay(snapshot, '2026-09-27').sessions === 1, 'previous days remain available');
assert(statsForDay(snapshot, day).sessions === 1, 'other days are not overwritten');

const novel = snapshot.novels.find((item) => item.bookId === 'book-1');
assert(novel?.readingTimeMs === 180_000, 'per-novel reading time');
assert(novel?.sessions === 1, 'per-novel sessions');
assert(novel?.chaptersRead === 3, 'per-novel chapters');

console.log('test-reading-stats: ok');

export type DailyReadingStats = {
  day: string;
  readingTimeMs: number;
  sessions: number;
  novelIds: string[];
  chaptersRead: number;
};

export type NovelReadingStat = {
  bookId: string;
  bookTitle?: string;
  readingTimeMs: number;
  sessions: number;
  chaptersRead: number;
  lastReadAt: number;
};

export type ReadingStatsSnapshot = {
  days: DailyReadingStats[];
  novels: NovelReadingStat[];
};

export function localDayKey(timestamp: number = Date.now()): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function emptyDailyStats(day: string): DailyReadingStats {
  return {
    day,
    readingTimeMs: 0,
    sessions: 0,
    novelIds: [],
    chaptersRead: 0,
  };
}

export function emptyNovelStat(bookId: string, bookTitle?: string): NovelReadingStat {
  return {
    bookId,
    bookTitle,
    readingTimeMs: 0,
    sessions: 0,
    chaptersRead: 0,
    lastReadAt: 0,
  };
}

export function ensureDailyStats(days: DailyReadingStats[], day: string): DailyReadingStats[] {
  if (days.some((item) => item.day === day)) return days;
  return [emptyDailyStats(day), ...days].sort((left, right) => right.day.localeCompare(left.day));
}

export function recordReadingTime(
  snapshot: ReadingStatsSnapshot,
  input: { bookId: string; bookTitle?: string; durationMs: number; day?: string; at?: number },
): ReadingStatsSnapshot {
  const durationMs = Math.max(0, Math.floor(input.durationMs));
  if (durationMs === 0) return snapshot;
  const at = input.at ?? Date.now();
  const day = input.day ?? localDayKey(at);
  const days = ensureDailyStats(snapshot.days, day).map((item) => (
    item.day === day
      ? { ...item, readingTimeMs: item.readingTimeMs + durationMs }
      : item
  ));
  const novels = upsertNovel(snapshot.novels, input.bookId, input.bookTitle, (stat) => ({
    ...stat,
    readingTimeMs: stat.readingTimeMs + durationMs,
    lastReadAt: at,
  }));
  return { days, novels };
}

export function recordReadingSession(
  snapshot: ReadingStatsSnapshot,
  input: { bookId: string; bookTitle?: string; day?: string; at?: number },
): ReadingStatsSnapshot {
  const at = input.at ?? Date.now();
  const day = input.day ?? localDayKey(at);
  const days = ensureDailyStats(snapshot.days, day).map((item) => (
    item.day === day
      ? {
          ...item,
          sessions: item.sessions + 1,
          novelIds: item.novelIds.includes(input.bookId) ? item.novelIds : [...item.novelIds, input.bookId],
        }
      : item
  ));
  const novels = upsertNovel(snapshot.novels, input.bookId, input.bookTitle, (stat) => ({
    ...stat,
    sessions: stat.sessions + 1,
    lastReadAt: at,
  }));
  return { days, novels };
}

export function recordChaptersRead(
  snapshot: ReadingStatsSnapshot,
  input: { bookId: string; bookTitle?: string; chapterCount?: number; day?: string; at?: number },
): ReadingStatsSnapshot {
  const count = Math.max(0, input.chapterCount ?? 1);
  if (count === 0) return snapshot;
  const at = input.at ?? Date.now();
  const day = input.day ?? localDayKey(at);
  const days = ensureDailyStats(snapshot.days, day).map((item) => (
    item.day === day
      ? { ...item, chaptersRead: item.chaptersRead + count }
      : item
  ));
  const novels = upsertNovel(snapshot.novels, input.bookId, input.bookTitle, (stat) => ({
    ...stat,
    chaptersRead: stat.chaptersRead + count,
    lastReadAt: at,
  }));
  return { days, novels };
}

function upsertNovel(
  novels: NovelReadingStat[],
  bookId: string,
  bookTitle: string | undefined,
  update: (stat: NovelReadingStat) => NovelReadingStat,
): NovelReadingStat[] {
  const existing = novels.find((stat) => stat.bookId === bookId);
  const base = existing ?? emptyNovelStat(bookId, bookTitle);
  const next = update({ ...base, bookTitle: bookTitle ?? base.bookTitle });
  return [next, ...novels.filter((stat) => stat.bookId !== bookId)];
}

export function statsForDay(snapshot: ReadingStatsSnapshot, day: string): DailyReadingStats {
  return snapshot.days.find((item) => item.day === day) ?? emptyDailyStats(day);
}

export function formatDayLabel(day: string): string {
  const [year, month, date] = day.split('-').map((part) => Number(part));
  if (!year || !month || !date) return day;
  return new Date(year, month - 1, date).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

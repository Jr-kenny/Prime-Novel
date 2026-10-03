import AsyncStorage from '@react-native-async-storage/async-storage';
import { durableStorageWrite } from './durable-storage';
import type { ReadingStatsSnapshot } from './reading-stats';

const readingStatsStorageKey = 'prime-reading-stats-v1';
const readingStatsBackupKey = 'prime-reading-stats-backup-v1';

export function emptyReadingStatsSnapshot(): ReadingStatsSnapshot {
  return { days: [], novels: [] };
}

function parseSnapshot(value: string | null): ReadingStatsSnapshot | undefined {
  if (value === null) return emptyReadingStatsSnapshot();
  try {
    const parsed = JSON.parse(value) as Partial<ReadingStatsSnapshot>;
    if (!parsed || typeof parsed !== 'object') return undefined;
    return {
      days: Array.isArray(parsed.days) ? parsed.days : [],
      novels: Array.isArray(parsed.novels) ? parsed.novels : [],
    };
  } catch {
    return undefined;
  }
}

export async function loadReadingStats(): Promise<ReadingStatsSnapshot> {
  const entries = await AsyncStorage.multiGet([readingStatsStorageKey, readingStatsBackupKey]);
  const primary = parseSnapshot(entries[0][1]);
  const backup = parseSnapshot(entries[1][1]);
  return primary ?? backup ?? emptyReadingStatsSnapshot();
}

export async function saveReadingStats(snapshot: ReadingStatsSnapshot): Promise<void> {
  const value = JSON.stringify(snapshot);
  await durableStorageWrite(() => AsyncStorage.setItem(readingStatsStorageKey, value));
  void AsyncStorage.setItem(readingStatsBackupKey, value).catch(() => {});
}

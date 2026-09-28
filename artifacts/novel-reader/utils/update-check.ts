import AsyncStorage from '@react-native-async-storage/async-storage';
import { durableStorageWrite } from './durable-storage';
import {
  compareAppVersions,
  currentAppVersion,
  fetchAppRelease,
  type AppRelease,
} from './app-updates';

export type UpdateCheckState =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'error';

export type UpdateCheckResult = {
  state: UpdateCheckState;
  release?: AppRelease;
  currentVersion: string;
  availableVersion?: string;
  checkedAt?: number;
  errorMessage?: string;
};

const lastCheckStorageKey = 'prime-update-last-check-v1';

export async function loadLastUpdateCheck(): Promise<{ checkedAt: number; version?: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(lastCheckStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { checkedAt?: number; version?: string };
    if (typeof parsed.checkedAt !== 'number') return null;
    return { checkedAt: parsed.checkedAt, version: parsed.version };
  } catch {
    return null;
  }
}

export async function saveLastUpdateCheck(payload: { checkedAt: number; version?: string }): Promise<void> {
  await durableStorageWrite(() => AsyncStorage.setItem(lastCheckStorageKey, JSON.stringify(payload))).catch(() => {});
}

export async function runUpdateCheck(): Promise<UpdateCheckResult> {
  const currentVersion = currentAppVersion();
  const checkedAt = Date.now();
  try {
    const release = await fetchAppRelease();
    const isAvailable = compareAppVersions(release.version, currentVersion) > 0;
    await saveLastUpdateCheck({ checkedAt, version: release.version });
    return {
      state: isAvailable ? 'available' : 'up-to-date',
      release,
      currentVersion,
      availableVersion: isAvailable ? release.version : undefined,
      checkedAt,
    };
  } catch (error) {
    await saveLastUpdateCheck({ checkedAt }).catch(() => {});
    return {
      state: 'error',
      currentVersion,
      checkedAt,
      errorMessage: error instanceof Error ? error.message : 'Unable to check for updates.',
    };
  }
}

export function updateStatusCopy(result: UpdateCheckResult): string {
  switch (result.state) {
    case 'checking':
      return 'Checking for updates...';
    case 'up-to-date':
      return `You're up to date (${result.currentVersion}).`;
    case 'available':
      return `Update available — Version ${result.availableVersion ?? 'unknown'}.`;
    case 'error':
      return result.errorMessage ?? 'Unable to check for updates.';
    default:
      return `Currently installed: ${result.currentVersion}.`;
  }
}

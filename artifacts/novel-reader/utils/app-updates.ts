import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const APP_RELEASE_MANIFEST_URL = 'https://primenovel.vercel.app/app-release.json';

export type AppRelease = {
  version: string;
  versionCode?: number;
  notes?: string[];
  android?: {
    url: string;
  };
  ios?: {
    url: string;
  };
};

export function currentAppVersion() {
  return Constants.expoConfig?.version ?? '1.0.0';
}

function versionParts(version: string) {
  return version.split('.').map((part) => Number.parseInt(part, 10) || 0);
}

export function compareAppVersions(left: string, right: string) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function releaseUrl(value: string) {
  try {
    return new URL(value, APP_RELEASE_MANIFEST_URL).toString();
  } catch {
    return value;
  }
}

export function platformRelease(release: AppRelease) {
  if (Platform.OS === 'android') return release.android;
  if (Platform.OS === 'ios') return release.ios;
  return release.android;
}

export async function fetchAppRelease(): Promise<AppRelease> {
  const response = await fetch(`${APP_RELEASE_MANIFEST_URL}?t=${Date.now()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Release check returned ${response.status}.`);
  const payload = await response.json() as Partial<AppRelease>;
  if (typeof payload.version !== 'string' || !payload.version.trim()) {
    throw new Error('The release manifest is invalid.');
  }
  return payload as AppRelease;
}

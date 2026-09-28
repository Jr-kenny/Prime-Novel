import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';
import { platformRelease, releaseUrl, type AppRelease } from './app-updates';
import { createPreUpdateBackup } from './data-recovery';

export type UpdateInstallPhase =
  | 'idle'
  | 'preparing'
  | 'downloading'
  | 'ready-to-install'
  | 'installing'
  | 'installed'
  | 'error';

export type UpdateInstallProgress = {
  phase: UpdateInstallPhase;
  progress: number;
  message?: string;
};

export type UpdateInstallResult = {
  phase: UpdateInstallPhase;
  message?: string;
  uri?: string;
};

const installerAction = 'android.intent.action.VIEW';
const installerFlags = 1;

function updateFilePath(version: string) {
  const safeVersion = version.replace(/[^0-9.]+/g, '-');
  return `${FileSystem.documentDirectory}prime-novel/updates/Prime-Novel-${safeVersion}.apk`;
}

export function updateInstallPhaseCopy(phase: UpdateInstallPhase): string {
  switch (phase) {
    case 'preparing':
      return 'Preparing the update package...';
    case 'downloading':
      return 'Downloading the update...';
    case 'ready-to-install':
      return 'Update downloaded. Approve the install prompt to finish.';
    case 'installing':
      return 'Opening the system installer...';
    case 'installed':
      return 'The installer finished. Open the updated app when you are ready.';
    case 'error':
      return 'The update could not be installed.';
    default:
      return 'Ready to download and install.';
  }
}

export async function downloadAndInstallUpdate(
  release: AppRelease,
  onProgress?: (progress: UpdateInstallProgress) => void,
): Promise<UpdateInstallResult> {
  const target = platformRelease(release);
  if (!target?.url) {
    const message = Platform.OS === 'ios'
      ? 'The iOS release is not available yet.'
      : 'No download is attached to this release.';
    onProgress?.({ phase: 'error', progress: 0, message });
    return { phase: 'error', message };
  }

  const url = releaseUrl(target.url);

  if (Platform.OS !== 'android') {
    onProgress?.({ phase: 'installing', progress: 0.5, message: 'Opening the download page...' });
    try {
      await Linking.openURL(url);
      onProgress?.({ phase: 'installed', progress: 1, message: 'Continue the install in your browser.' });
      return { phase: 'installed', message: 'Continue the install in your browser.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The update link could not be opened.';
      onProgress?.({ phase: 'error', progress: 0, message });
      return { phase: 'error', message };
    }
  }

  if (!FileSystem.documentDirectory) {
    const message = 'Local storage is unavailable for the update package.';
    onProgress?.({ phase: 'error', progress: 0, message });
    return { phase: 'error', message };
  }

  try {
    onProgress?.({ phase: 'preparing', progress: 0, message: updateInstallPhaseCopy('preparing') });
    await createPreUpdateBackup();

    const directory = `${FileSystem.documentDirectory}prime-novel/updates/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const destination = updateFilePath(release.version);

    const existing = await FileSystem.getInfoAsync(destination);
    if (existing.exists && typeof existing.size === 'number' && existing.size > 0) {
      onProgress?.({ phase: 'ready-to-install', progress: 1, message: 'Using the previously downloaded update.' });
    } else {
      onProgress?.({ phase: 'downloading', progress: 0.15, message: updateInstallPhaseCopy('downloading') });
      const downloadResult = await FileSystem.downloadAsync(url, destination);
      if (downloadResult.status < 200 || downloadResult.status >= 300) {
        throw new Error(`Download returned ${downloadResult.status}.`);
      }
      onProgress?.({ phase: 'ready-to-install', progress: 1, message: updateInstallPhaseCopy('ready-to-install') });
    }

    onProgress?.({ phase: 'installing', progress: 1, message: updateInstallPhaseCopy('installing') });
    const contentUri = await FileSystem.getContentUriAsync(destination);
    await IntentLauncher.startActivityAsync(installerAction, {
      data: contentUri,
      type: 'application/vnd.android.package-archive',
      flags: installerFlags,
    });

    onProgress?.({ phase: 'installed', progress: 1, message: updateInstallPhaseCopy('installed') });
    return { phase: 'installed', message: updateInstallPhaseCopy('installed'), uri: destination };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The update could not be installed.';
    onProgress?.({ phase: 'error', progress: 0, message });
    return { phase: 'error', message };
  }
}

export async function clearDownloadedUpdate(version: string): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  try {
    await FileSystem.deleteAsync(updateFilePath(version), { idempotent: true });
  } catch {
    // Best-effort cleanup only.
  }
}

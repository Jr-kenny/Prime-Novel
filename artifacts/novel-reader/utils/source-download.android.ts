import * as FileSystem from 'expo-file-system/legacy';
import type { RepositoryPackage } from './repository-sync';
import type { SourceDownloadResult } from './source-download';

function safeFileName(source: RepositoryPackage) {
  return `${source.id.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 90)}.package`;
}

export async function downloadSourcePackage(source: RepositoryPackage): Promise<SourceDownloadResult> {
  if (!source.url) return { error: 'This source has no downloadable package.' };
  if (!FileSystem.documentDirectory) return { error: 'Local storage is unavailable.' };

  try {
    const directory = `${FileSystem.documentDirectory}prime-novel/source-packages/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const destination = `${directory}${safeFileName(source)}`;
    const result = await FileSystem.downloadAsync(source.url, destination);
    if (result.status < 200 || result.status >= 300) return { error: `Download returned ${result.status}.` };
    return { uri: result.uri };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Source download failed.' };
  }
}

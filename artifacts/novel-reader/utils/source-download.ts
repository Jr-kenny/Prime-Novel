import type { RepositoryPackage } from './repository-sync';

export type SourceDownloadResult = {
  uri?: string;
  error?: string;
};

export async function downloadSourcePackage(_source: RepositoryPackage): Promise<SourceDownloadResult> {
  return { error: 'Custom source downloads are available on Android.' };
}

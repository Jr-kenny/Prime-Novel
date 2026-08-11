export type RepositoryPackageType = 'source' | 'style' | 'library';

export type RepositoryPackage = {
  id: string;
  name: string;
  description?: string;
  packageType: RepositoryPackageType;
  version?: string;
  language?: string;
  fileName?: string;
  imageUrl?: string;
  author?: string;
  url?: string;
  checksum?: string;
};

export type RepositorySyncResult = {
  packages: RepositoryPackage[];
  error?: string;
};

// The Android implementation resolves this module on Android builds. The
// shared fallback keeps custom repository behavior out of iOS and web builds.
export async function fetchRepositoryPackages(_url: string): Promise<RepositorySyncResult> {
  return { packages: [], error: 'Custom repositories are available on Android.' };
}

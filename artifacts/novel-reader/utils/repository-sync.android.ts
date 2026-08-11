import type { RepositoryPackage, RepositoryPackageType, RepositorySyncResult } from './repository-sync';

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return asString(value);
}

function packageType(value: unknown): RepositoryPackageType {
  const normalized = asString(value)?.toLowerCase() ?? '';
  if (normalized.includes('style')) return 'style';
  if (normalized.includes('lib')) return 'library';
  return 'source';
}

function resolveUrl(baseUrl: string, value?: string) {
  if (!value) return undefined;
  try {
    return new URL(value, `${baseUrl.replace(/\/+$/, '')}/`).toString();
  } catch {
    return undefined;
  }
}

function packageUrl(baseUrl: string, record: Record<string, unknown>, type: RepositoryPackageType) {
  const directUrl = asString(record.url) ?? asString(record.downloadUrl) ?? asString(record.path);
  if (directUrl) return resolveUrl(baseUrl, directUrl);

  const fileName = asString(record.fileName) ?? asString(record.name);
  if (!fileName) return undefined;

  if (type === 'source') {
    const language = asString(record.lang) ?? asString(record.language) ?? 'en';
    return resolveUrl(baseUrl, `src/${language}/${fileName}.lua`);
  }
  if (type === 'library') return resolveUrl(baseUrl, `lib/${fileName}.lua`);
  return resolveUrl(baseUrl, `styles/${fileName}`);
}

function candidateArrays(payload: unknown): Array<{ values: unknown[]; type: RepositoryPackageType }> {
  if (Array.isArray(payload)) return [{ values: payload, type: 'source' }];
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as Record<string, unknown>;
  return [
    { key: 'sources', type: 'source' as const },
    { key: 'extensions', type: 'source' as const },
    { key: 'scripts', type: 'source' as const },
    { key: 'items', type: 'source' as const },
    { key: 'entries', type: 'source' as const },
    { key: 'libraries', type: 'library' as const },
    { key: 'styles', type: 'style' as const },
  ].flatMap(({ key, type }) => Array.isArray(record[key]) ? [{ values: record[key] as unknown[], type }] : []);
}

function normalizePackage(baseUrl: string, raw: unknown, fallbackType: RepositoryPackageType, index: number): RepositoryPackage | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const name = asString(record.name) ?? asString(record.title) ?? asString(record.fileName) ?? `Source ${index + 1}`;
  const id = asId(record.id) ?? asString(record.slug) ?? asString(record.fileName) ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const fileName = asString(record.fileName);
  const language = asString(record.lang) ?? asString(record.language);
  const resolvedType = packageType(record.type ?? record.kind ?? fallbackType);

  return {
    id,
    name,
    description: asString(record.description),
    packageType: resolvedType,
    version: asString(record.version) ?? asString(record.ver),
    language,
    fileName,
    imageUrl: asString(record.imageURL) ?? asString(record.imageUrl) ?? asString(record.icon),
    author: asString(record.author),
    url: packageUrl(baseUrl, record, resolvedType),
    checksum: asString(record.sha256) ?? asString(record.md5) ?? asString(record.checksum),
  };
}

export async function fetchRepositoryPackages(url: string): Promise<RepositorySyncResult> {
  const baseUrl = url.replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/index.json`);
  if (!response.ok) return { packages: [], error: `Repository returned ${response.status}.` };

  const payload = await response.json() as unknown;
  const packages = candidateArrays(payload)
    .flatMap(({ values, type }) => values.map((item, index) => normalizePackage(baseUrl, item, type, index)))
    .filter((item): item is RepositoryPackage => Boolean(item));

  return { packages };
}

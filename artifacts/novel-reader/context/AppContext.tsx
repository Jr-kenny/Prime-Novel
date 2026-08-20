import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { RepositoryPackage, RepositoryPackageType } from '@/utils/repository-sync';
import { fetchRepositoryPackages } from '@/utils/repository-sync';
import { downloadSourcePackage } from '@/utils/source-download';
import { PRIME_SOURCE_REGISTRY } from '@/data/prime-sources';

export type LibraryLayout = 'shelf' | 'grid';
export type UpdateFrequency = 'off' | 'hourly' | 'daily';
export type AppTheme = 'cream' | 'white' | 'dark';

export type AppSettings = {
  appTheme: AppTheme;
  autoBookmarkFromShare: boolean;
  downloadConcurrency: number;
  downloadOnUpdate: boolean;
  libraryLayout: LibraryLayout;
  onlyUpdateOngoing: boolean;
  syncOnLaunch: boolean;
  updateFrequency: UpdateFrequency;
  verifySourceChecksums: boolean;
};

export type SourceRecord = {
  id: string;
  name: string;
  kind: 'built-in' | 'repository';
  url?: string;
  repositoryId?: string;
  packageId?: string;
  packageType?: RepositoryPackageType;
  version?: string;
  language?: string;
  fileName?: string;
  imageUrl?: string;
  author?: string;
  localPath?: string;
  enabled: boolean;
  bookCount: number;
  lastSyncedAt?: number;
};

export type RepositoryRecord = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  packageCount: number;
  lastSyncedAt?: number;
  error?: string;
};

export type AvailableSource = RepositoryPackage & {
  repositoryId: string;
  installed: boolean;
  lastSyncedAt: number;
};

export type HistoryEntry = {
  id: string;
  bookId: string;
  chapter: number;
  openedAt: number;
};

export type ReadingSession = {
  id: string;
  bookId: string;
  durationMs: number;
  words: number;
  recordedAt: number;
};

type AppSnapshot = {
  settings: AppSettings;
  sources: SourceRecord[];
  repositories: RepositoryRecord[];
  availableSources: AvailableSource[];
  sharedLinks: string[];
  history: HistoryEntry[];
  recentSearches: string[];
  readingSessions: ReadingSession[];
};

type AppContextValue = AppSnapshot & {
  addRepository: (url: string, name?: string) => boolean;
  addShareLink: (url: string) => boolean;
  clearSourceCache: () => void;
  installSource: (sourceId: string) => Promise<boolean>;
  recordHistory: (entry: Omit<HistoryEntry, 'id' | 'openedAt'>) => void;
  recordRecentSearch: (query: string) => void;
  recordReadingSession: (bookId: string, durationMs: number, words: number) => void;
  removeRepository: (repositoryId: string) => void;
  removeSource: (sourceId: string) => void;
  setSetting: <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => void;
  syncSources: () => Promise<{ repositories: number; packages: number; failed: number }>;
  toggleRepository: (repositoryId: string) => void;
  toggleSource: (sourceId: string) => void;
  hydrated: boolean;
};

const defaultSettings: AppSettings = {
  appTheme: 'cream',
  autoBookmarkFromShare: true,
  downloadConcurrency: 3,
  downloadOnUpdate: false,
  libraryLayout: 'shelf',
  onlyUpdateOngoing: true,
  syncOnLaunch: true,
  updateFrequency: 'daily',
  verifySourceChecksums: true,
};

const defaultSources: SourceRecord[] = PRIME_SOURCE_REGISTRY.map((source) => ({
  id: source.id,
  name: source.name,
  kind: 'built-in' as const,
  url: source.siteUrl,
  packageType: 'source' as const,
  version: source.provenance.version,
  language: source.language,
  fileName: source.provenance.fileName,
  imageUrl: source.imageUrl,
  enabled: true,
  bookCount: 0,
  lastSyncedAt: Date.now(),
}));

const defaultRepositories: RepositoryRecord[] = [];

const initialSnapshot: AppSnapshot = {
  settings: defaultSettings,
  sources: defaultSources,
  repositories: defaultRepositories,
  availableSources: [],
  sharedLinks: [],
  history: [],
  recentSearches: [],
  readingSessions: [],
};

const AppContext = createContext<AppContextValue | null>(null);

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeSettings(stored: Partial<AppSettings>) {
  const storedFrequency = (stored as { updateFrequency?: string }).updateFrequency;
  const updateFrequency: UpdateFrequency = storedFrequency === 'hourly' || storedFrequency === 'daily'
    ? storedFrequency
    : storedFrequency === 'manual' || storedFrequency === 'off'
      ? 'off'
      : defaultSettings.updateFrequency;
  return { ...defaultSettings, ...stored, updateFrequency };
}

function normalizeSources(stored: SourceRecord[]) {
  const customSources = stored.filter((source) => source.kind !== 'built-in');
  const storedById = new Map(stored.filter((source) => source.kind === 'built-in').map((source) => [source.id, source]));
  const builtInSources = defaultSources.map((source) => ({ ...source, ...storedById.get(source.id) }));
  return [...builtInSources, ...customSources];
}

function sourceIdForUrl(url: string) {
  let hash = 0;
  for (let index = 0; index < url.length; index += 1) {
    hash = (hash * 31 + url.charCodeAt(index)) | 0;
  }
  return `repository-${Math.abs(hash)}`;
}

function sourceNameForUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Custom repository';
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [sources, setSources] = useState<SourceRecord[]>(defaultSources);
  const [repositories, setRepositories] = useState<RepositoryRecord[]>(defaultRepositories);
  const [availableSources, setAvailableSources] = useState<AvailableSource[]>([]);
  const [sharedLinks, setSharedLinks] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const launchSyncStarted = useRef(false);
  const storageWriteRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    AsyncStorage.multiGet(['prime-settings', 'prime-sources', 'prime-repositories', 'prime-available-sources', 'prime-shared-links', 'prime-history', 'prime-recent-searches', 'prime-reading-sessions'])
      .then((entries) => {
        setSettings(normalizeSettings(parseJson<Partial<AppSettings>>(entries[0][1], {})));
        setSources(normalizeSources(parseJson<SourceRecord[]>(entries[1][1], defaultSources)));
        setRepositories(parseJson<RepositoryRecord[]>(entries[2][1], defaultRepositories));
        setAvailableSources(parseJson<AvailableSource[]>(entries[3][1], []));
        setSharedLinks(parseJson<string[]>(entries[4][1], []));
        setHistory(parseJson<HistoryEntry[]>(entries[5][1], []));
        setRecentSearches(parseJson<string[]>(entries[6][1], []));
        setReadingSessions(parseJson<ReadingSession[]>(entries[7][1], []));
      })
      .finally(() => setHydrated(true));
  }, []);

  const persist = useCallback((next: Partial<AppSnapshot>) => {
    const entries: Array<[string, string]> = [];
    if (next.settings) entries.push(['prime-settings', JSON.stringify(next.settings)]);
    if (next.sources) entries.push(['prime-sources', JSON.stringify(next.sources)]);
    if (next.repositories) entries.push(['prime-repositories', JSON.stringify(next.repositories)]);
    if (next.availableSources) entries.push(['prime-available-sources', JSON.stringify(next.availableSources)]);
    if (next.sharedLinks) entries.push(['prime-shared-links', JSON.stringify(next.sharedLinks)]);
    if (next.history) entries.push(['prime-history', JSON.stringify(next.history)]);
    if (next.recentSearches) entries.push(['prime-recent-searches', JSON.stringify(next.recentSearches)]);
    if (next.readingSessions) entries.push(['prime-reading-sessions', JSON.stringify(next.readingSessions)]);
    if (entries.length === 0) return;
    storageWriteRef.current = storageWriteRef.current
      .catch(() => {})
      .then(() => AsyncStorage.multiSet(entries));
  }, []);

  const setSetting = useCallback(<Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      persist({ settings: next });
      return next;
    });
  }, [persist]);

  const addRepository = useCallback((rawUrl: string, customName?: string) => {
    if (process.env.EXPO_OS !== 'android') return false;
    const url = rawUrl.trim();
    if (!/^https?:\/\/[^\s]+$/i.test(url)) return false;
    const id = sourceIdForUrl(url);
    const nextRepository: RepositoryRecord = {
      id,
      name: customName?.trim() || sourceNameForUrl(url),
      url,
      enabled: true,
      packageCount: 0,
    };
    setRepositories((current) => {
      const next = [nextRepository, ...current.filter((repository) => repository.id !== id)];
      persist({ repositories: next });
      return next;
    });
    return true;
  }, [persist]);

  const addShareLink = useCallback((rawUrl: string) => {
    const url = rawUrl.trim();
    if (!/^https?:\/\/[^\s]+$/i.test(url)) return false;
    setSharedLinks((current) => {
      const next = [url, ...current.filter((item) => item !== url)].slice(0, 50);
      persist({ sharedLinks: next });
      return next;
    });
    return true;
  }, [persist]);

  const toggleSource = useCallback((sourceId: string) => {
    setSources((current) => {
      const next = current.map((source) => source.id === sourceId ? { ...source, enabled: !source.enabled } : source);
      persist({ sources: next });
      return next;
    });
  }, [persist]);

  const toggleRepository = useCallback((repositoryId: string) => {
    setRepositories((current) => {
      const next = current.map((repository) => repository.id === repositoryId ? { ...repository, enabled: !repository.enabled } : repository);
      persist({ repositories: next });
      return next;
    });
  }, [persist]);

  const removeRepository = useCallback((repositoryId: string) => {
    setRepositories((current) => {
      const next = current.filter((repository) => repository.id !== repositoryId);
      persist({ repositories: next });
      return next;
    });
    setAvailableSources((current) => {
      const next = current.filter((source) => source.repositoryId !== repositoryId);
      persist({ availableSources: next });
      return next;
    });
    setSources((current) => {
      const next = current.filter((source) => source.repositoryId !== repositoryId);
      persist({ sources: next });
      return next;
    });
  }, [persist]);

  const removeSource = useCallback((sourceId: string) => {
    let removedPackageId: string | undefined;
    setSources((current) => {
      removedPackageId = current.find((source) => source.id === sourceId)?.packageId;
      const next = current.filter((source) => source.id !== sourceId || source.kind === 'built-in');
      persist({ sources: next });
      return next;
    });
    if (removedPackageId) {
      setAvailableSources((current) => {
        const next = current.map((source) => source.id === removedPackageId ? { ...source, installed: false } : source);
        persist({ availableSources: next });
        return next;
      });
    }
  }, [persist]);

  const installSource = useCallback(async (sourceId: string) => {
    const available = availableSources.find((source) => source.id === sourceId);
    if (!available) return false;
    const download = await downloadSourcePackage(available);
    if (!download.uri) return false;
    const installedSource: SourceRecord = {
      id: `source-${available.repositoryId}-${available.id}`,
      name: available.name,
      kind: 'repository',
      url: available.url,
      repositoryId: available.repositoryId,
      packageId: available.id,
      packageType: available.packageType,
      version: available.version,
      language: available.language,
      fileName: available.fileName,
      imageUrl: available.imageUrl,
      author: available.author,
      localPath: download.uri,
      enabled: true,
      bookCount: 0,
      lastSyncedAt: available.lastSyncedAt,
    };
    setSources((current) => {
      const next = [installedSource, ...current.filter((source) => source.id !== installedSource.id)];
      persist({ sources: next });
      return next;
    });
    setAvailableSources((current) => {
      const next = current.map((source) => source.id === sourceId ? { ...source, installed: true } : source);
      persist({ availableSources: next });
      return next;
    });
    return true;
  }, [availableSources, persist]);

  const syncSources = useCallback(async () => {
    if (process.env.EXPO_OS !== 'android') return { repositories: 0, packages: 0, failed: 0 };
    const enabledRepositories = repositories.filter((repository) => repository.enabled);
    if (enabledRepositories.length === 0) return { repositories: 0, packages: 0, failed: 0 };

    const results = await Promise.all(enabledRepositories.map(async (repository) => {
      const result = await fetchRepositoryPackages(repository.url).catch((error: unknown) => ({
        packages: [],
        error: error instanceof Error ? error.message : 'Repository could not be reached.',
      }));
      return { repository, result };
    }));
    const lastSyncedAt = Date.now();
    const syncedPackages = results.flatMap(({ repository, result }) => result.packages.map((source) => ({
      ...source,
      id: `${repository.id}:${source.id}`,
      repositoryId: repository.id,
      installed: sources.some((installed) => installed.repositoryId === repository.id && installed.packageId === source.id),
      lastSyncedAt,
    })));

    setAvailableSources((current) => {
      const untouched = current.filter((source) => !enabledRepositories.some((repository) => repository.id === source.repositoryId));
      const next = [...syncedPackages, ...untouched];
      persist({ availableSources: next });
      return next;
    });
    setRepositories((current) => {
      const next = current.map((repository) => {
        const result = results.find((item) => item.repository.id === repository.id)?.result;
        if (!result) return repository;
        return {
          ...repository,
          packageCount: result.packages.length,
          lastSyncedAt,
          error: result.error,
        };
      });
      persist({ repositories: next });
      return next;
    });

    return {
      repositories: results.length,
      packages: syncedPackages.filter((source) => source.packageType === 'source').length,
      failed: results.filter(({ result }) => Boolean(result.error)).length,
    };
  }, [persist, repositories, sources]);

  useEffect(() => {
    if (!hydrated || !settings.syncOnLaunch || repositories.length === 0 || launchSyncStarted.current) return;
    launchSyncStarted.current = true;
    void syncSources();
  }, [hydrated, repositories.length, settings.syncOnLaunch, syncSources]);

  const clearSourceCache = useCallback(() => {
    setAvailableSources([]);
    persist({ availableSources: [] });
    setRepositories((current) => {
      const next = current.map((repository) => ({ ...repository, packageCount: 0, lastSyncedAt: undefined, error: undefined }));
      persist({ repositories: next });
      return next;
    });
  }, [persist]);

  const recordHistory = useCallback((entry: Omit<HistoryEntry, 'id' | 'openedAt'>) => {
    const nextEntry: HistoryEntry = { ...entry, id: `${entry.bookId}:${entry.chapter}`, openedAt: Date.now() };
    setHistory((current) => {
      const next = [nextEntry, ...current.filter((item) => item.id !== nextEntry.id)].slice(0, 100);
      persist({ history: next });
      return next;
    });
  }, [persist]);

  const recordRecentSearch = useCallback((rawQuery: string) => {
    const query = rawQuery.trim().replace(/\s+/g, ' ');
    if (!query) return;
    setRecentSearches((current) => {
      const normalizedQuery = query.toLocaleLowerCase();
      const next = [query, ...current.filter((item) => item.toLocaleLowerCase() !== normalizedQuery)].slice(0, 10);
      persist({ recentSearches: next });
      return next;
    });
  }, [persist]);

  const recordReadingSession = useCallback((bookId: string, durationMs: number, words: number) => {
    if (durationMs <= 0) return;
    const session: ReadingSession = {
      id: `${bookId}:${Date.now()}`,
      bookId,
      durationMs,
      words: Math.max(0, Math.round(words)),
      recordedAt: Date.now(),
    };
    setReadingSessions((current) => {
      const next = [...current, session].slice(-500);
      persist({ readingSessions: next });
      return next;
    });
  }, [persist]);

  const value = useMemo<AppContextValue>(() => ({
    settings,
    sources,
    repositories,
    availableSources,
    sharedLinks,
    history,
    recentSearches,
    readingSessions,
    addRepository,
    addShareLink,
    clearSourceCache,
    installSource,
    recordHistory,
    recordRecentSearch,
    recordReadingSession,
    removeRepository,
    removeSource,
    setSetting,
    syncSources,
    toggleRepository,
    toggleSource,
    hydrated,
  }), [addRepository, addShareLink, availableSources, clearSourceCache, hydrated, history, installSource, recordHistory, recordRecentSearch, recordReadingSession, recentSearches, removeRepository, removeSource, readingSessions, repositories, setSetting, settings, sharedLinks, sources, syncSources, toggleRepository, toggleSource]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}

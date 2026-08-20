import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { PRIME_SOURCE_REGISTRY, getPrimeSource } from '@/data/prime-sources';
import { useApp } from '@/context/AppContext';
import {
  flattenSearchResults,
  loadPrimeChapter,
  loadPrimeNovel,
  searchPrimeSourcesIncremental,
  type PrimeChapter,
  type PrimeChapterContent,
  type PrimeNovel,
  type PrimeNovelDetails,
  type PrimeSourceSearchResult,
} from '@/utils/prime-source-adapters';
import { loadPrimeChapterOnWeb, loadPrimeNovelOnWeb, searchPrimeSourcesOnWebIncremental } from '@/utils/catalog-web-api';
import { readPersistentBackup, writePersistentBackup } from '@/utils/persistent-backup';
import { rankTitleSearchResults } from '@/utils/search-ranking';
import { durableStorageWrite } from '@/utils/durable-storage';

export type DownloadedChapter = {
  key: string;
  sourceId: string;
  novelId: string;
  novelTitle: string;
  chapter: PrimeChapter;
  content?: PrimeChapterContent;
  downloadedAt: number;
};

type CatalogContextValue = {
  results: PrimeNovel[];
  sourceResults: PrimeSourceSearchResult[];
  searching: boolean;
  searchError?: string;
  downloads: DownloadedChapter[];
  downloadsHydrated: boolean;
  search: (query: string) => Promise<void>;
  getNovel: (novel: PrimeNovel) => Promise<PrimeNovelDetails>;
  getChapter: (chapter: PrimeChapter, sourceId: string) => Promise<PrimeChapterContent>;
  downloadChapter: (novel: PrimeNovel, chapter: PrimeChapter) => Promise<DownloadedChapter>;
  downloadAllChapters: (
    novel: PrimeNovel,
    chapters: PrimeChapter[],
    onProgress?: (completed: number, total: number, failed: number) => void,
  ) => Promise<{ downloaded: number; failed: number; total: number }>;
  removeDownload: (key: string) => void;
  getDownloadedChapter: (key: string) => DownloadedChapter | undefined;
  clearResults: () => void;
};

const legacyDownloadsStorageKey = 'prime-chapter-cache';
const downloadsStorageKey = 'prime-chapter-index-v2';
const downloadsBackupStorageKey = 'prime-chapter-index-backup-v2';
const downloadContentStoragePrefix = 'prime-chapter-content:';
const downloadDirectory = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}prime-novel/chapters/` : undefined;
const CatalogContext = createContext<CatalogContextValue | null>(null);

function chapterCacheKey(sourceId: string, chapterId: string) {
  return `${sourceId}:${chapterId}`;
}

function cacheFileName(key: string) {
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < key.length; index += 1) {
    const character = key.charCodeAt(index);
    first = Math.imul(first ^ character, 16777619);
    second = Math.imul(second, 33) ^ character;
  }
  return `${first >>> 0}-${second >>> 0}.json`;
}

function downloadMetadata(download: DownloadedChapter): DownloadedChapter {
  const { content: _content, ...metadata } = download;
  return metadata;
}

function parseDownloads(value: string | null): DownloadedChapter[] | undefined {
  if (value === null) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    if (!parsed.every((download) => download && typeof download === 'object' && typeof (download as DownloadedChapter).key === 'string')) return undefined;
    return parsed as DownloadedChapter[];
  } catch {
    return undefined;
  }
}

async function writeChapterContent(key: string, content: PrimeChapterContent) {
  const value = JSON.stringify(content);
  if (Platform.OS !== 'web' && downloadDirectory) {
    await FileSystem.makeDirectoryAsync(downloadDirectory, { intermediates: true });
    await FileSystem.writeAsStringAsync(`${downloadDirectory}${cacheFileName(key)}`, value);
    return;
  }
  await AsyncStorage.setItem(`${downloadContentStoragePrefix}${key}`, value);
}

async function readChapterContent(key: string) {
  const value = Platform.OS !== 'web' && downloadDirectory
    ? await FileSystem.readAsStringAsync(`${downloadDirectory}${cacheFileName(key)}`)
    : await AsyncStorage.getItem(`${downloadContentStoragePrefix}${key}`);
  if (!value) throw new Error('The offline chapter file is missing.');
  return JSON.parse(value) as PrimeChapterContent;
}

async function chapterContentExists(key: string) {
  if (Platform.OS !== 'web' && downloadDirectory) {
    return (await FileSystem.getInfoAsync(`${downloadDirectory}${cacheFileName(key)}`)).exists;
  }
  return (await AsyncStorage.getItem(`${downloadContentStoragePrefix}${key}`)) !== null;
}

async function deleteChapterContent(key: string) {
  if (Platform.OS !== 'web' && downloadDirectory) {
    await FileSystem.deleteAsync(`${downloadDirectory}${cacheFileName(key)}`, { idempotent: true });
    return;
  }
  await AsyncStorage.removeItem(`${downloadContentStoragePrefix}${key}`);
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const { settings, sources } = useApp();
  const [results, setResults] = useState<PrimeNovel[]>([]);
  const [sourceResults, setSourceResults] = useState<PrimeSourceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | undefined>();
  const [downloads, setDownloads] = useState<DownloadedChapter[]>([]);
  const [downloadsHydrated, setDownloadsHydrated] = useState(false);
  const downloadsRef = useRef<DownloadedChapter[]>([]);
  const downloadsHydrationRef = useRef<Promise<void>>(Promise.resolve());
  const downloadsWriteRef = useRef<Promise<void>>(Promise.resolve());
  const downloadsHydratedRef = useRef(false);
  const lastDownloadsBackupAtRef = useRef(0);
  const searchRequestRef = useRef(0);

  const commitDownloads = useCallback(async (metadata: DownloadedChapter[]) => {
    await durableStorageWrite(() => AsyncStorage.setItem(downloadsStorageKey, JSON.stringify(metadata)));
    if (metadata.length === 0) return;
    void AsyncStorage.setItem(downloadsBackupStorageKey, JSON.stringify(metadata)).catch(() => {});
    if (Date.now() - lastDownloadsBackupAtRef.current >= 15_000) {
      lastDownloadsBackupAtRef.current = Date.now();
      void writePersistentBackup('download-index', metadata).catch(() => {});
    }
  }, []);

  useEffect(() => {
    downloadsHydrationRef.current = AsyncStorage.multiGet([downloadsStorageKey, legacyDownloadsStorageKey, downloadsBackupStorageKey])
      .then(async (entries) => {
        const indexed = parseDownloads(entries[0][1]);
        const legacy = parseDownloads(entries[1][1]);
        const asyncBackup = parseDownloads(entries[2][1]);
        const fileBackup = indexed === undefined ? await readPersistentBackup<DownloadedChapter[]>('download-index') : undefined;
        const stored = indexed === undefined
          ? legacy ?? asyncBackup ?? fileBackup
          : indexed.length === 0 && legacy?.length
            ? legacy
            : indexed;
        if (!stored) throw new Error('Stored downloads could not be read safely.');
        downloadsRef.current = stored;
        setDownloads(stored.map(downloadMetadata));

        if (legacy?.length) {
          await Promise.all(legacy.map(async (download) => {
            if (download.content && !await chapterContentExists(download.key)) await writeChapterContent(download.key, download.content);
          }).map((migration) => migration.catch(() => {
            // Keep the legacy entry available when one chapter file cannot be migrated.
          })));
        }
        if (legacy && stored === legacy && stored.length > 0) {
          await AsyncStorage.setItem(downloadsStorageKey, JSON.stringify(stored.map(downloadMetadata))).catch(() => {});
          downloadsRef.current = stored.map(downloadMetadata);
        }
        if (stored.length > 0) {
          const metadata = stored.map(downloadMetadata);
          await Promise.all([
            AsyncStorage.setItem(downloadsBackupStorageKey, JSON.stringify(metadata)),
            writePersistentBackup('download-index', metadata),
          ]).catch(() => {});
        }
      })
      .then(() => {
        downloadsHydratedRef.current = true;
        setDownloadsHydrated(true);
      })
      .catch(() => {
        downloadsHydratedRef.current = false;
        setDownloadsHydrated(false);
      });
  }, []);

  const persistDownloads = useCallback(async (next: DownloadedChapter[]) => {
    const metadata = next.map(downloadMetadata);
    downloadsRef.current = metadata;
    setDownloads(metadata);
    downloadsWriteRef.current = downloadsWriteRef.current
      .catch(() => {})
      .then(() => commitDownloads(metadata));
    await downloadsWriteRef.current;
  }, [commitDownloads]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' || !downloadsHydratedRef.current) return;
      downloadsWriteRef.current = downloadsWriteRef.current
        .catch(() => {})
        .then(() => commitDownloads(downloadsRef.current.map(downloadMetadata)));
    });
    return () => subscription.remove();
  }, [commitDownloads]);

  const enabledSources = useMemo(
    () => PRIME_SOURCE_REGISTRY.filter((source) => source.active !== false && sources.find((record) => record.id === source.id)?.enabled !== false),
    [sources],
  );

  const search = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    if (trimmedQuery.length < 1) {
      setResults([]);
      setSourceResults([]);
      setSearchError(undefined);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchError(undefined);
    setResults([]);
    setSourceResults([]);
    try {
      let nextSourceResults: PrimeSourceSearchResult[];
      if (Platform.OS === 'web') {
        const incrementalResults = new Map<string, PrimeSourceSearchResult>();
        nextSourceResults = await searchPrimeSourcesOnWebIncremental(trimmedQuery, enabledSources, (partialResult) => {
          if (requestId !== searchRequestRef.current) return;
          incrementalResults.set(partialResult.source.id, partialResult);
          const visibleResults = Array.from(incrementalResults.values());
          setSourceResults(visibleResults);
          setResults(rankTitleSearchResults(flattenSearchResults(visibleResults), trimmedQuery));
        });
      } else {
        const incrementalResults = new Map<string, PrimeSourceSearchResult>();
        nextSourceResults = await searchPrimeSourcesIncremental(enabledSources, trimmedQuery, (partialResult) => {
          if (requestId !== searchRequestRef.current) return;
          incrementalResults.set(partialResult.source.id, partialResult);
          const visibleResults = Array.from(incrementalResults.values());
          setSourceResults(visibleResults);
          setResults(rankTitleSearchResults(flattenSearchResults(visibleResults), trimmedQuery));
        });
      }
      if (requestId !== searchRequestRef.current) return;
      setSourceResults(nextSourceResults);
      setResults(rankTitleSearchResults(flattenSearchResults(nextSourceResults), trimmedQuery));
      if (nextSourceResults.every((result) => result.error)) setSearchError('The enabled sources could not be reached.');
    } catch {
      if (requestId === searchRequestRef.current) setSearchError('Search could not be completed.');
    } finally {
      if (requestId === searchRequestRef.current) setSearching(false);
    }
  }, [enabledSources]);

  const getNovel = useCallback(async (novel: PrimeNovel) => {
    const source = getPrimeSource(novel.sourceId);
    if (!source) throw new Error('This novel source is unavailable.');
    return Platform.OS === 'web' ? loadPrimeNovelOnWeb(novel) : loadPrimeNovel(source, novel);
  }, []);

  const getChapter = useCallback(async (chapter: PrimeChapter, sourceId: string) => {
    await downloadsHydrationRef.current;
    const key = chapterCacheKey(sourceId, chapter.id);
    const cached = downloadsRef.current.find((download) => download.key === key);
    if (cached?.content) return cached.content;
    if (cached) {
      try {
        return await readChapterContent(key);
      } catch {
        await persistDownloads(downloadsRef.current.filter((download) => download.key !== key));
      }
    }
    const source = getPrimeSource(sourceId);
    if (!source) throw new Error('This chapter source is unavailable.');
    return Platform.OS === 'web' ? loadPrimeChapterOnWeb(chapter, sourceId) : loadPrimeChapter(source, chapter);
  }, [persistDownloads]);

  const downloadChapter = useCallback(async (novel: PrimeNovel, chapter: PrimeChapter) => {
    await downloadsHydrationRef.current;
    const key = chapterCacheKey(novel.sourceId, chapter.id);
    const existing = downloadsRef.current.find((download) => download.key === key);
    if (existing) {
      try {
        const content = existing.content ?? await readChapterContent(key);
        return { ...existing, content };
      } catch {
        await persistDownloads(downloadsRef.current.filter((download) => download.key !== key));
      }
    }
    const content = await getChapter(chapter, novel.sourceId);
    const download: DownloadedChapter = {
      key,
      sourceId: novel.sourceId,
      novelId: novel.id,
      novelTitle: novel.title,
      chapter,
      content,
      downloadedAt: Date.now(),
    };
    await writeChapterContent(key, content);
    const concurrentlyStored = downloadsRef.current.find((item) => item.key === key);
    if (!concurrentlyStored) await persistDownloads([download, ...downloadsRef.current]);
    return download;
  }, [getChapter, persistDownloads]);

  const downloadAllChapters = useCallback(async (
    novel: PrimeNovel,
    chapters: PrimeChapter[],
    onProgress?: (completed: number, total: number, failed: number) => void,
  ) => {
    if (chapters.length === 0) return { downloaded: 0, failed: 0, total: 0 };

    const requestedConcurrency = Number(settings.downloadConcurrency);
    const concurrency = Number.isFinite(requestedConcurrency)
      ? Math.max(1, Math.min(12, Math.floor(requestedConcurrency)))
      : 1;
    const workerCount = Math.min(concurrency, chapters.length);
    let nextIndex = 0;
    let downloaded = 0;
    let failed = 0;

    const worker = async () => {
      while (true) {
        const chapterIndex = nextIndex;
        nextIndex += 1;
        if (chapterIndex >= chapters.length) return;

        try {
          await downloadChapter(novel, chapters[chapterIndex]);
          downloaded += 1;
        } catch {
          failed += 1;
        }
        onProgress?.(downloaded + failed, chapters.length, failed);
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return { downloaded, failed, total: chapters.length };
  }, [downloadChapter, settings.downloadConcurrency]);

  const removeDownload = useCallback((key: string) => {
    void persistDownloads(downloadsRef.current.filter((download) => download.key !== key))
      .then(() => deleteChapterContent(key))
      .catch(() => {});
  }, [persistDownloads]);

  const getDownloadedChapter = useCallback((key: string) => downloadsRef.current.find((download) => download.key === key), []);
  const clearResults = useCallback(() => {
    searchRequestRef.current += 1;
    setResults([]);
    setSourceResults([]);
    setSearchError(undefined);
    setSearching(false);
  }, []);

  const value = useMemo<CatalogContextValue>(() => ({
    results,
    sourceResults,
    searching,
    searchError,
    downloads,
    downloadsHydrated,
    search,
    getNovel,
    getChapter,
    downloadChapter,
    downloadAllChapters,
    removeDownload,
    getDownloadedChapter,
    clearResults,
  }), [clearResults, downloadAllChapters, downloadChapter, downloads, downloadsHydrated, getChapter, getDownloadedChapter, getNovel, removeDownload, results, search, searchError, searching, sourceResults]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error('useCatalog must be used inside CatalogProvider');
  return context;
}

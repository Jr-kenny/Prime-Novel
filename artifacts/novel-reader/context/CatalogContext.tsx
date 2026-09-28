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
import {
  deleteDownloadDatabaseRecord,
  loadDownloadDatabaseRecords,
  persistDownloadDatabaseRecords,
  upsertDownloadDatabaseRecord,
} from '@/utils/persistent-database';
import {
  createDownloadJob,
  finishJob,
  jobChapterToPrimeChapter,
  jobPendingChapters,
  jobRetryChapters,
  markJobChapterCompleted,
  markJobChapterFailed,
  type DownloadJob,
  type DownloadJobChapter,
} from '@/utils/download-jobs';
import { loadDownloadJobs, upsertDownloadJob } from '@/utils/download-job-storage';

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
  downloadJobs: DownloadJob[];
  search: (query: string) => Promise<void>;
  getNovel: (novel: PrimeNovel) => Promise<PrimeNovelDetails>;
  getChapter: (chapter: PrimeChapter, sourceId: string) => Promise<PrimeChapterContent>;
  downloadChapter: (novel: PrimeNovel, chapter: PrimeChapter) => Promise<DownloadedChapter>;
  downloadAllChapters: (
    novel: PrimeNovel,
    chapters: PrimeChapter[],
    onProgress?: (completed: number, total: number, failed: number) => void,
  ) => Promise<{ downloaded: number; failed: number; total: number; skipped: number }>;
  resumeDownloadJob: (
    novel: PrimeNovel,
    chapters: PrimeChapter[],
    onProgress?: (completed: number, total: number, failed: number) => void,
  ) => Promise<{ downloaded: number; failed: number; total: number; skipped: number }>;
  resumeInterruptedDownloads: () => Promise<void>;
  removeDownload: (key: string) => void;
  getDownloadedChapter: (key: string) => DownloadedChapter | undefined;
  getDownloadJob: (novelId: string) => DownloadJob | undefined;
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
    const destination = `${downloadDirectory}${cacheFileName(key)}`;
    const temporary = `${destination}.tmp`;
    await FileSystem.writeAsStringAsync(temporary, value);
    await FileSystem.deleteAsync(destination, { idempotent: true });
    await FileSystem.moveAsync({ from: temporary, to: destination });
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
  const [downloadJobs, setDownloadJobs] = useState<DownloadJob[]>([]);
  const downloadJobsRef = useRef<DownloadJob[]>([]);
  const activeDownloadJobIdsRef = useRef<Set<string>>(new Set());
  const downloadsRef = useRef<DownloadedChapter[]>([]);
  const downloadsHydrationRef = useRef<Promise<void>>(Promise.resolve());
  const downloadsWriteRef = useRef<Promise<void>>(Promise.resolve());
  const downloadsHydratedRef = useRef(false);
  const lastDownloadsBackupAtRef = useRef(0);
  const searchRequestRef = useRef(0);

  const commitDownloads = useCallback(async (metadata: DownloadedChapter[]) => {
    persistDownloadDatabaseRecords(metadata);
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
        const databaseDownloads = loadDownloadDatabaseRecords<DownloadedChapter>();
        const indexed = parseDownloads(entries[0][1]);
        const legacy = parseDownloads(entries[1][1]);
        const asyncBackup = parseDownloads(entries[2][1]);
        const fileBackup = indexed === undefined || indexed.length === 0 ? await readPersistentBackup<DownloadedChapter[]>('download-index') : undefined;
        const stored = databaseDownloads ?? (indexed === undefined
          ? legacy ?? asyncBackup ?? fileBackup
          : indexed.length === 0 && legacy?.length
            ? legacy
            : indexed.length === 0 && asyncBackup?.length
              ? asyncBackup
              : indexed.length === 0 && fileBackup?.length
                ? fileBackup
            : indexed);
        if (!stored) throw new Error('Stored downloads could not be read safely.');
        downloadsRef.current = stored;
        setDownloads(stored.map(downloadMetadata));
        persistDownloadDatabaseRecords(stored.map(downloadMetadata));

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

    void loadDownloadJobs()
      .then((jobs) => {
        downloadJobsRef.current = jobs;
        setDownloadJobs(jobs);
      })
      .catch(() => {
        downloadJobsRef.current = [];
        setDownloadJobs([]);
      });
  }, []);

  const commitDownloadJob = useCallback(async (job: DownloadJob) => {
    downloadJobsRef.current = [job, ...downloadJobsRef.current.filter((item) => item.id !== job.id)];
    setDownloadJobs(downloadJobsRef.current);
    await upsertDownloadJob(job).catch(() => {});
  }, []);

  const persistDownloads = useCallback(async (next: DownloadedChapter[]) => {
    const metadata = next.map(downloadMetadata);
    downloadsRef.current = metadata;
    setDownloads(metadata);
    persistDownloadDatabaseRecords(metadata);
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

  const saveDownloadedChapter = useCallback(async (novel: PrimeNovel, chapter: PrimeChapter, persistLegacyIndex: boolean) => {
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
    if (!concurrentlyStored) {
      const metadata = downloadMetadata(download);
      upsertDownloadDatabaseRecord(metadata);
      const next = [metadata, ...downloadsRef.current];
      downloadsRef.current = next;
      setDownloads(next);
      if (persistLegacyIndex) await commitDownloads(next);
    }
    return download;
  }, [commitDownloads, getChapter, persistDownloads]);

  const downloadChapter = useCallback(
    (novel: PrimeNovel, chapter: PrimeChapter) => saveDownloadedChapter(novel, chapter, true),
    [saveDownloadedChapter],
  );

  const runDownloadJob = useCallback(async (
    novel: PrimeNovel,
    chapters: PrimeChapter[],
    mode: 'all' | 'resume',
    onProgress?: (completed: number, total: number, failed: number) => void,
  ) => {
    if (chapters.length === 0) {
      return { downloaded: 0, failed: 0, total: 0, skipped: 0 };
    }
    if (activeDownloadJobIdsRef.current.has(novel.id)) {
      return { downloaded: 0, failed: 0, total: chapters.length, skipped: chapters.length };
    }

    activeDownloadJobIdsRef.current.add(novel.id);
    try {
    const downloadedKeys = new Set(downloadsRef.current.map((download) => download.key));
    const jobChapters: DownloadJobChapter[] = chapters.map((chapter) => ({
      key: chapterCacheKey(novel.sourceId, chapter.id),
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      url: chapter.url,
      releaseDate: chapter.releaseDate,
    }));

    const existingJob = downloadJobsRef.current.find((job) => job.id === novel.id);
    const baseJob = existingJob && existingJob.novelId === novel.id
      ? {
          ...existingJob,
          chapters: jobChapters,
          completedKeys: existingJob.completedKeys.filter((key) => downloadedKeys.has(key)),
        }
      : createDownloadJob({
          sourceId: novel.sourceId,
          novelId: novel.id,
          novelTitle: novel.title,
          novelUrl: novel.url,
          chapters: jobChapters,
        });

    let job: DownloadJob = { ...baseJob, status: 'running', updatedAt: Date.now() };
    await commitDownloadJob(job);

    const pendingKeys = new Set(jobPendingChapters(job, downloadedKeys).map((chapter) => chapter.key));
    const retryKeys = new Set(jobRetryChapters(job, downloadedKeys).map((chapter) => chapter.key));
    const pending = chapters.filter((chapter) => {
      const key = chapterCacheKey(novel.sourceId, chapter.id);
      return mode === 'resume' ? (pendingKeys.has(key) || retryKeys.has(key)) : pendingKeys.has(key);
    });

    const skipped = jobChapters.length - pending.length;
    const requestedConcurrency = Number(settings.downloadConcurrency);
    const concurrency = Number.isFinite(requestedConcurrency)
      ? Math.max(1, Math.min(12, Math.floor(requestedConcurrency)))
      : 1;
    const workerCount = Math.min(concurrency, Math.max(pending.length, 1));
    let nextIndex = 0;
    let downloaded = 0;
    let failed = 0;

    const worker = async () => {
      while (true) {
        const chapterIndex = nextIndex;
        nextIndex += 1;
        if (chapterIndex >= pending.length) return;

        const chapter = pending[chapterIndex];
        try {
          await saveDownloadedChapter(novel, chapter, false);
          downloaded += 1;
          job = markJobChapterCompleted(job, chapterCacheKey(novel.sourceId, chapter.id));
        } catch {
          failed += 1;
          job = markJobChapterFailed(job, chapterCacheKey(novel.sourceId, chapter.id));
        }
        await commitDownloadJob(job);
        onProgress?.(downloaded + failed + skipped, jobChapters.length, failed);
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    await commitDownloads(downloadsRef.current.map(downloadMetadata));
    job = finishJob(job);
    await commitDownloadJob(job);
    return { downloaded, failed, total: jobChapters.length, skipped };
    } finally {
      activeDownloadJobIdsRef.current.delete(novel.id);
    }
  }, [commitDownloadJob, commitDownloads, saveDownloadedChapter, settings.downloadConcurrency]);

  const downloadAllChapters = useCallback(async (
    novel: PrimeNovel,
    chapters: PrimeChapter[],
    onProgress?: (completed: number, total: number, failed: number) => void,
  ) => runDownloadJob(novel, chapters, 'all', onProgress), [runDownloadJob]);

  const resumeDownloadJob = useCallback(async (
    novel: PrimeNovel,
    chapters: PrimeChapter[],
    onProgress?: (completed: number, total: number, failed: number) => void,
  ) => runDownloadJob(novel, chapters, 'resume', onProgress), [runDownloadJob]);

  const resumeInterruptedDownloads = useCallback(async () => {
    await downloadsHydrationRef.current;
    const jobs = downloadJobsRef.current.filter((job) => (
      job.status === 'interrupted'
      || job.status === 'failed'
      || job.status === 'running'
    ));
    for (const job of jobs) {
      if (activeDownloadJobIdsRef.current.has(job.id)) continue;
      const downloadedKeys = new Set(downloadsRef.current.map((download) => download.key));
      const pending = job.chapters.filter((chapter) => {
        const pendingKeys = new Set(jobPendingChapters(job, downloadedKeys).map((item) => item.key));
        const retryKeys = new Set(jobRetryChapters(job, downloadedKeys).map((item) => item.key));
        return pendingKeys.has(chapter.key) || retryKeys.has(chapter.key);
      });
      if (pending.length === 0) {
        await commitDownloadJob(finishJob({ ...job, status: 'running' }));
        continue;
      }
      const novel: PrimeNovel = {
        id: job.novelId,
        sourceId: job.sourceId,
        title: job.novelTitle,
        url: job.novelUrl,
      };
      const chapters = job.chapters.map((chapter) => jobChapterToPrimeChapter(job, chapter));
      await runDownloadJob(novel, chapters, 'resume');
    }
  }, [commitDownloadJob, runDownloadJob]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void resumeInterruptedDownloads().catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [resumeInterruptedDownloads]);

  useEffect(() => {
    if (!downloadsHydrated) return;
    void resumeInterruptedDownloads().catch(() => {});
  }, [downloadsHydrated, resumeInterruptedDownloads]);

  const removeDownload = useCallback((key: string) => {
    deleteDownloadDatabaseRecord(key);
    void persistDownloads(downloadsRef.current.filter((download) => download.key !== key))
      .then(() => deleteChapterContent(key))
      .catch(() => {});
  }, [persistDownloads]);

  const getDownloadedChapter = useCallback((key: string) => downloadsRef.current.find((download) => download.key === key), []);
  const getDownloadJob = useCallback((novelId: string) => downloadJobsRef.current.find((job) => job.id === novelId), []);
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
    downloadJobs,
    search,
    getNovel,
    getChapter,
    downloadChapter,
    downloadAllChapters,
    resumeDownloadJob,
    resumeInterruptedDownloads,
    removeDownload,
    getDownloadedChapter,
    getDownloadJob,
    clearResults,
  }), [clearResults, downloadAllChapters, downloadChapter, downloadJobs, downloads, downloadsHydrated, getChapter, getDownloadJob, getDownloadedChapter, getNovel, removeDownload, resumeDownloadJob, resumeInterruptedDownloads, results, search, searchError, searching, sourceResults]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error('useCatalog must be used inside CatalogProvider');
  return context;
}

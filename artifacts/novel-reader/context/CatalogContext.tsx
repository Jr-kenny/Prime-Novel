import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
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

export type DownloadedChapter = {
  key: string;
  sourceId: string;
  novelId: string;
  novelTitle: string;
  chapter: PrimeChapter;
  content: PrimeChapterContent;
  downloadedAt: number;
};

type CatalogContextValue = {
  results: PrimeNovel[];
  sourceResults: PrimeSourceSearchResult[];
  searching: boolean;
  searchError?: string;
  downloads: DownloadedChapter[];
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

const downloadsStorageKey = 'prime-chapter-cache';
const CatalogContext = createContext<CatalogContextValue | null>(null);

function chapterCacheKey(sourceId: string, chapterId: string) {
  return `${sourceId}:${chapterId}`;
}

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function searchRank(novel: PrimeNovel, normalizedQuery: string) {
  const title = normalizeSearchText(novel.title);
  const words = title.split(' ');
  if (title === normalizedQuery) return 0;
  if (title.startsWith(`${normalizedQuery} `) || title.startsWith(normalizedQuery)) return 1;
  if (words.some((word) => word.startsWith(normalizedQuery))) return 2;
  if (title.includes(normalizedQuery)) return 3;
  return 4;
}

function rankSearchResults(novels: PrimeNovel[], query: string) {
  const normalizedQuery = normalizeSearchText(query);
  return novels
    .map((novel, index) => ({ novel, index, rank: searchRank(novel, normalizedQuery) }))
    .sort((left, right) => {
      if (left.rank !== right.rank) return left.rank - right.rank;
      const titleLength = left.novel.title.length - right.novel.title.length;
      if (titleLength !== 0) return titleLength;
      return left.index - right.index;
    })
    .map(({ novel }) => novel);
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const { settings, sources } = useApp();
  const [results, setResults] = useState<PrimeNovel[]>([]);
  const [sourceResults, setSourceResults] = useState<PrimeSourceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | undefined>();
  const [downloads, setDownloads] = useState<DownloadedChapter[]>([]);
  const downloadsRef = useRef<DownloadedChapter[]>([]);
  const downloadsHydrationRef = useRef<Promise<void>>(Promise.resolve());
  const searchRequestRef = useRef(0);

  useEffect(() => {
    downloadsHydrationRef.current = AsyncStorage.getItem(downloadsStorageKey)
      .then((value) => {
        if (!value) return;
        try {
          const stored = JSON.parse(value) as DownloadedChapter[];
          downloadsRef.current = stored;
          setDownloads(stored);
        } catch {
          downloadsRef.current = [];
        }
      })
      .catch(() => {
        downloadsRef.current = [];
      });
  }, []);

  const persistDownloads = useCallback((next: DownloadedChapter[]) => {
    downloadsRef.current = next;
    setDownloads(next);
    void AsyncStorage.setItem(downloadsStorageKey, JSON.stringify(next));
  }, []);

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
          setResults(rankSearchResults(flattenSearchResults(visibleResults), trimmedQuery));
        });
      } else {
        const incrementalResults = new Map<string, PrimeSourceSearchResult>();
        nextSourceResults = await searchPrimeSourcesIncremental(enabledSources, trimmedQuery, (partialResult) => {
          if (requestId !== searchRequestRef.current) return;
          incrementalResults.set(partialResult.source.id, partialResult);
          const visibleResults = Array.from(incrementalResults.values());
          setSourceResults(visibleResults);
          setResults(rankSearchResults(flattenSearchResults(visibleResults), trimmedQuery));
        });
      }
      if (requestId !== searchRequestRef.current) return;
      setSourceResults(nextSourceResults);
      setResults(rankSearchResults(flattenSearchResults(nextSourceResults), trimmedQuery));
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
    if (cached) return cached.content;
    const source = getPrimeSource(sourceId);
    if (!source) throw new Error('This chapter source is unavailable.');
    return Platform.OS === 'web' ? loadPrimeChapterOnWeb(chapter, sourceId) : loadPrimeChapter(source, chapter);
  }, []);

  const downloadChapter = useCallback(async (novel: PrimeNovel, chapter: PrimeChapter) => {
    const key = chapterCacheKey(novel.sourceId, chapter.id);
    const existing = downloadsRef.current.find((download) => download.key === key);
    if (existing) return existing;
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
    persistDownloads([download, ...downloadsRef.current]);
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
    persistDownloads(downloadsRef.current.filter((download) => download.key !== key));
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
    search,
    getNovel,
    getChapter,
    downloadChapter,
    downloadAllChapters,
    removeDownload,
    getDownloadedChapter,
    clearResults,
  }), [clearResults, downloadAllChapters, downloadChapter, downloads, getChapter, getDownloadedChapter, getNovel, removeDownload, results, search, searchError, searching, sourceResults]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error('useCatalog must be used inside CatalogProvider');
  return context;
}

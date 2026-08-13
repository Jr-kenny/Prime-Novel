import type {
  PrimeChapter,
  PrimeChapterContent,
  PrimeNovel,
  PrimeNovelDetails,
  PrimeSourceSearchResult,
} from './prime-source-adapters';

const catalogApiPath = '/api/catalog';

async function requestCatalog<T>(params: URLSearchParams) {
  const response = await fetch(`${catalogApiPath}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : 'The catalogue service could not be reached.';
    throw new Error(message);
  }
  return payload as T;
}

export function searchPrimeSourcesOnWeb(query: string, sourceIds?: string[]) {
  const params = new URLSearchParams({ op: 'search', q: query });
  if (sourceIds && sourceIds.length > 0) params.set('sourceIds', sourceIds.join(','));
  return requestCatalog<PrimeSourceSearchResult[]>(params);
}

export async function searchPrimeSourcesOnWebIncremental(
  query: string,
  sources: Array<PrimeSourceSearchResult['source']>,
  onResult: (result: PrimeSourceSearchResult) => void,
) {
  const results = await Promise.all(sources.map(async (source) => {
    try {
      const sourceResults = await searchPrimeSourcesOnWeb(query, [source.id]);
      const result = sourceResults[0] ?? { source, novels: [] } satisfies PrimeSourceSearchResult;
      onResult(result);
      return result;
    } catch (error) {
      const result = {
        source,
        novels: [],
        error: error instanceof Error ? error.message : 'Source could not be reached.',
      } satisfies PrimeSourceSearchResult;
      onResult(result);
      return result;
    }
  }));
  return results;
}

export function loadPrimeNovelOnWeb(novel: PrimeNovel) {
  return requestCatalog<PrimeNovelDetails>(new URLSearchParams({
    op: 'novel',
    sourceId: novel.sourceId,
    sourceRecordId: novel.sourceRecordId ?? '',
    title: novel.title,
    url: novel.url,
    coverUrl: novel.coverUrl ?? '',
  }));
}

export function loadPrimeChapterOnWeb(chapter: PrimeChapter, sourceId: string) {
  return requestCatalog<PrimeChapterContent>(new URLSearchParams({
    op: 'chapter',
    sourceId,
    novelId: chapter.novelId ?? '',
    id: chapter.id,
    number: String(chapter.number),
    title: chapter.title,
    url: chapter.url,
    releaseDate: chapter.releaseDate ?? '',
  }));
}

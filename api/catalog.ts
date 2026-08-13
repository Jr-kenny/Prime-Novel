import {
  loadPrimeChapter,
  loadPrimeNovel,
  searchPrimeSources,
  type PrimeChapter,
  type PrimeNovel,
} from '../artifacts/novel-reader/utils/prime-source-adapters';
import { getPrimeSource, PRIME_SOURCE_REGISTRY } from '../artifacts/novel-reader/data/prime-sources';

type QueryValue = string | string[] | undefined;
type CatalogRequest = { method?: string; query?: Record<string, QueryValue> };
type CatalogResponse = {
  status: (code: number) => CatalogResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

export const config = { maxDuration: 60 };

function queryValue(request: CatalogRequest, key: string) {
  const value = request.query?.[key];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function requestedSources(request: CatalogRequest) {
  const sourceIds = queryValue(request, 'sourceIds')
    .split(',')
    .map((sourceId) => sourceId.trim())
    .filter(Boolean);
  if (sourceIds.length === 0) return PRIME_SOURCE_REGISTRY.filter((source) => source.active !== false);
  const requested = new Set(sourceIds);
  return PRIME_SOURCE_REGISTRY.filter((source) => source.active !== false && requested.has(source.id));
}

function sendError(response: CatalogResponse, status: number, message: string) {
  response.status(status).json({ error: message });
}

function setCache(response: CatalogResponse, seconds: number) {
  response.setHeader('Cache-Control', `s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`);
}

export default async function handler(request: CatalogRequest, response: CatalogResponse) {
  if (request.method && request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendError(response, 405, 'Only GET requests are supported.');
  }

  const operation = queryValue(request, 'op');

  try {
    if (operation === 'search') {
      const query = queryValue(request, 'q').trim();
      if (!query) return sendError(response, 400, 'A search query is required.');
      setCache(response, 120);
      return response.status(200).json(await searchPrimeSources(requestedSources(request), query));
    }

    const sourceId = queryValue(request, 'sourceId');
    const source = getPrimeSource(sourceId);
    if (!source) return sendError(response, 400, 'This catalogue source is unavailable.');

    if (operation === 'novel') {
      const url = queryValue(request, 'url');
      const title = queryValue(request, 'title');
      if (!url || !title) return sendError(response, 400, 'A novel title and URL are required.');
      const novel: PrimeNovel = {
        id: `${sourceId}:${url}`,
        sourceId,
        sourceRecordId: queryValue(request, 'sourceRecordId') || undefined,
        title,
        url,
        coverUrl: queryValue(request, 'coverUrl') || undefined,
      };
      setCache(response, 300);
      return response.status(200).json(await loadPrimeNovel(source, novel));
    }

    if (operation === 'chapter') {
      const url = queryValue(request, 'url');
      if (!url) return sendError(response, 400, 'A chapter URL is required.');
      const chapter: PrimeChapter = {
        id: queryValue(request, 'id') || `${sourceId}:${url}`,
        novelId: queryValue(request, 'novelId') || undefined,
        number: Number(queryValue(request, 'number')) || 1,
        title: queryValue(request, 'title') || 'Chapter',
        url,
        releaseDate: queryValue(request, 'releaseDate') || undefined,
      };
      setCache(response, 300);
      return response.status(200).json(await loadPrimeChapter(source, chapter));
    }

    return sendError(response, 400, 'Unknown catalogue operation.');
  } catch (error) {
    return sendError(response, 502, error instanceof Error ? error.message : 'The catalogue source could not be reached.');
  }
}

import { parseDocument, DomUtils } from 'htmlparser2';
import { selectAll, selectOne as selectOneRaw } from 'css-select';
import type { AnyNode, Element } from 'domhandler';
import type { PrimeSourceAdapterId, PrimeSourceDefinition } from '../data/prime-sources';

export type PrimeNovel = {
  id: string;
  sourceId: string;
  sourceRecordId?: string;
  title: string;
  url: string;
  author?: string;
  coverUrl?: string;
  description?: string;
  genres?: string[];
  status?: string;
  chapterCount?: number;
};

export type PrimeChapter = {
  id: string;
  novelId?: string;
  number: number;
  title: string;
  url: string;
  releaseDate?: string;
};

export type PrimeNovelDetails = PrimeNovel & {
  chapters: PrimeChapter[];
};

export type PrimeChapterContent = {
  chapter: PrimeChapter;
  paragraphs: string[];
};

export type PrimeSourceSearchResult = {
  source: PrimeSourceDefinition;
  novels: PrimeNovel[];
  error?: string;
};

const REQUEST_TIMEOUT_MS = 20_000;
const SEARCH_TIMEOUT_MS = 8_000;
const africanStorybookCatalogCache = new Map<string, Promise<string>>();
const requestHeaders = {
  Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
};

function selectOne(selector: string, root: AnyNode) {
  return selectOneRaw<AnyNode, Element>(selector, root);
}

function sourceError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return 'Source could not be reached.';
}

async function requestText(url: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      headers: { ...requestHeaders, ...(init?.headers ?? {}) },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Source returned ${response.status}.`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function requestJson<T>(url: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const text = await requestText(url, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  }, timeoutMs);
  return JSON.parse(text) as T;
}

function absoluteUrl(value: string | undefined, baseUrl: string) {
  if (!value) return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function normalizeText(value: string | undefined) {
  return value?.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
}

function firstNode(root: AnyNode, selectors: string[]) {
  for (const selector of selectors) {
    const node = selectOne(selector, root);
    if (node) return node;
  }
  return undefined;
}

function nodes(root: AnyNode, selector: string) {
  return selectAll<AnyNode, Element>(selector, root);
}

function nodeText(node: AnyNode | null | undefined) {
  return node ? normalizeText(DomUtils.getText(node)) : '';
}

function nodeAttribute(node: Element | null | undefined, name: string) {
  return node ? DomUtils.getAttributeValue(node, name) : undefined;
}

function imageUrl(node: Element | null | undefined, baseUrl: string) {
  if (!node) return undefined;
  const srcSet = nodeAttribute(node, 'srcset') ?? nodeAttribute(node, 'data-srcset');
  const largestSrc = srcSet?.split(',').map((part: string) => part.trim().split(/\s+/)[0]).filter(Boolean).pop();
  return absoluteUrl(
    largestSrc ?? nodeAttribute(node, 'data-lazy-src') ?? nodeAttribute(node, 'data-src') ?? nodeAttribute(node, 'data-cfsrc') ?? nodeAttribute(node, 'src'),
    baseUrl,
  );
}

function firstAttribute(root: AnyNode, selectors: string[], attribute: string, baseUrl: string) {
  const node = firstNode(root, selectors);
  return absoluteUrl(nodeAttribute(node, attribute), baseUrl);
}

function cleanParagraphs(root: AnyNode, selectors: string[]) {
  const container = firstNode(root, selectors);
  if (!container) return [];

  const paragraphs = nodes(container, 'p')
    .map((paragraph) => nodeText(paragraph))
    .filter((paragraph) => paragraph.length > 0);
  if (paragraphs.length > 0) return paragraphs;

  return nodeText(container)
    .split(/\n+/)
    .map((paragraph: string) => normalizeText(paragraph))
    .filter(Boolean);
}

function titleFromLink(node: Element | null | undefined, fallback = 'Untitled') {
  return nodeText(node) || normalizeText(nodeAttribute(node, 'title')) || normalizeText(nodeAttribute(node, 'aria-label')) || fallback;
}

function novelId(sourceId: string, url: string) {
  return `${sourceId}:${url}`;
}

function titleFromUrl(url: string) {
  try {
    const segment = new URL(url).pathname.split('/').filter(Boolean).pop() ?? 'Untitled';
    return decodeURIComponent(segment).replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    return 'Untitled';
  }
}

function chapterId(novel: PrimeNovel, url: string) {
  return `${novel.id}:${url}`;
}

function cleanHtmlParagraphs(html: string) {
  return cleanParagraphs(parseDocument(`<body>${html}</body>`), ['body']);
}

function stripUrlQuery(url: string) {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function parseRoyalRoadSearch(source: PrimeSourceDefinition, html: string) {
  const root = parseDocument(html);
  return nodes(root, '.fiction-list .fiction-list-item, .fiction-list > div, .fiction-list > li')
    .flatMap((item) => {
      const link = selectOne('.fiction-title a, h2 a, a[href*="/fiction/"]', item);
      const url = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
      if (!link || !url) return [];
      const cover = imageUrl(selectOne('a img, img', item), source.siteUrl);
      return [{
        id: novelId(source.id, url),
        sourceId: source.id,
        title: titleFromLink(link, nodeAttribute(selectOne('img', item), 'alt') || 'Untitled'),
        url,
        coverUrl: cover,
      } satisfies PrimeNovel];
    })
}

function parseGenericSearch(source: PrimeSourceDefinition, html: string) {
  const root = parseDocument(html);
  const candidates = nodes(root, [
    '.search_data_results a',
    '.c-tabs-item__content',
    '.archive .list .row',
    '.ul-list1.ul-list1-2.ss-custom .li-row',
    '.UpdateList .clearfix.itemBox',
    'li.flex',
    '.fiction-list .fiction-list-item',
    '.novel-list .novel-item',
    '.novel-list article',
    '.search-results article',
    '.search-results li',
    '.list-story',
    '.story-item',
    '.novel-item',
    'article',
  ].join(', '));
  const seen = new Set<string>();

  return candidates.flatMap((candidate) => {
    const link = selectOne('a[href]', candidate) ?? (candidate.name === 'a' ? candidate : undefined);
    const url = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    if (!link || !url || seen.has(url)) return [];
    const titleNode = selectOne('[title], .title, .novel-title, .itemTxt .title, h2, h3, h4, a', candidate) ?? link;
    const title = titleFromLink(titleNode, titleFromUrl(url));
    if (title.length < 2 || /^read more|view details|chapter/i.test(title)) return [];
    seen.add(url);
    return [{
      id: novelId(source.id, url),
      sourceId: source.id,
      title,
      url,
      coverUrl: imageUrl(selectOne('img', candidate), source.siteUrl),
    } satisfies PrimeNovel];
  });
}

function parseWattpadSearch(source: PrimeSourceDefinition, data: { stories?: Array<{ title?: string; cover?: string; url?: string }> }) {
  return (data.stories ?? []).flatMap((item) => {
    const url = absoluteUrl(item.url, source.siteUrl);
    if (!url || !item.title) return [];
    return [{ id: novelId(source.id, url), sourceId: source.id, title: item.title, url, coverUrl: item.cover } satisfies PrimeNovel];
  });
}

type WattpadPart = {
  title?: string;
  url?: string;
  createDate?: string;
  isPaywalled?: boolean;
};

function extractJsonArray(html: string, marker: string) {
  const markerStart = html.indexOf(marker);
  if (markerStart < 0) return undefined;
  const arrayStart = html.indexOf('[', markerStart + marker.length);
  if (arrayStart < 0) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = arrayStart; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
    } else if (character === '[') {
      depth += 1;
    } else if (character === ']') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(arrayStart, index + 1)) as unknown;
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

function parseWattpadParts(html: string) {
  const parts = extractJsonArray(html, '"parts":');
  if (!Array.isArray(parts)) return [] as WattpadPart[];
  return parts.filter((part): part is WattpadPart => Boolean(part && typeof part === 'object'));
}

function parseWattpadDetails(source: PrimeSourceDefinition, html: string, url: string) {
  const root = parseDocument(html);
  const metaContent = (selector: string) => nodeAttribute(selectOne(selector, root), 'content');
  const status = html.match(/>(Complete|Ongoing)</i)?.[1];
  const novel: PrimeNovel = {
    id: novelId(source.id, url),
    sourceId: source.id,
    title: normalizeText(metaContent('meta[property="og:title"]')) || nodeText(firstNode(root, ['.gF-N5', 'h1'])) || 'Untitled',
    url,
    author: nodeText(firstNode(root, ['.author-info .info strong', '.af6dp', '[data-testid="story-author"]', '.author'])),
    coverUrl: absoluteUrl(metaContent('meta[property="og:image"]'), source.siteUrl) ?? imageUrl(firstNode(root, ['.cover__BlyZa', 'img.cover', 'img']), source.siteUrl),
    description: normalizeText(metaContent('meta[name="description"]')) || nodeText(firstNode(root, ['.glL-c', '[data-testid="story-description"]', '.description'])),
    genres: nodes(root, '.AMIOO a, [data-testid="story-category"] a').map((item) => nodeText(item)).filter(Boolean),
    status: status ?? nodeText(firstNode(root, ['.typography-label-small-semi', '[data-testid="story-status"]'])),
  };
  const partToChapter = (part: WattpadPart, index: number) => {
    const chapterUrl = absoluteUrl(part.url, source.siteUrl);
    if (!chapterUrl) return [];
    const title = normalizeText(part.title) || 'Chapter ' + (index + 1);
    return [{
      id: chapterId(novel, chapterUrl),
      novelId: novel.id,
      number: index + 1,
      title: part.isPaywalled ? 'Locked · ' + title : title,
      url: chapterUrl,
      releaseDate: part.createDate?.slice(0, 10),
    } satisfies PrimeChapter];
  };
  const embeddedParts = parseWattpadParts(html);
  const chapters = embeddedParts.length > 0
    ? embeddedParts.flatMap(partToChapter)
    : nodes(root, '.pPt69 .Y26Ib ul li, [data-testid="story-part"]').flatMap((row, index) => {
      const link = selectOne('a[href]', row);
      const chapterUrl = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
      if (!chapterUrl) return [];
      const locked = Boolean(selectOne('[data-testid="block-part-icon"]', row));
      const title = titleFromLink(selectOne('a div div', row) ?? link, 'Chapter ' + (index + 1));
      return [{
        id: chapterId(novel, chapterUrl),
        novelId: novel.id,
        number: index + 1,
        title: locked ? 'Locked · ' + title : title,
        url: chapterUrl,
      } satisfies PrimeChapter];
    });
  return { ...novel, chapterCount: chapters.length, chapters } satisfies PrimeNovelDetails;
}

function parseMadaraSearch(source: PrimeSourceDefinition, html: string) {
  const root = parseDocument(html);
  return nodes(root, '.c-tabs-item__content').flatMap((item) => {
    const link = selectOne('a[title], .tab-thumb a, .tab-summary a, h3 a, a[href*="/novel/"], a[href*="/series/"]', item);
    const url = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    if (!link || !url) return [];
    const title = titleFromLink(link, nodeText(selectOne('h3, .post-title', item)) || titleFromUrl(url));
    return [{ id: novelId(source.id, url), sourceId: source.id, title, url, coverUrl: imageUrl(selectOne('img', item), source.siteUrl) } satisfies PrimeNovel];
  });
}

function parseCreativeSearch(source: PrimeSourceDefinition, html: string) {
  const root = parseDocument(html);
  return nodes(root, '.search_data_results a').flatMap((link) => {
    const url = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    if (!url) return [];
    const title = titleFromLink(link, titleFromUrl(url));
    return [{ id: novelId(source.id, url), sourceId: source.id, title, url, coverUrl: imageUrl(selectOne('.cover_art img, img', link), source.siteUrl) } satisfies PrimeNovel];
  });
}

function parseAsianSearch(source: PrimeSourceDefinition, html: string) {
  const root = parseDocument(html);
  return nodes(root, 'li.flex').flatMap((item) => {
    const link = selectOne('div.title a, a[href]', item);
    const url = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    if (!link || !url) return [];
    return [{ id: novelId(source.id, url), sourceId: source.id, title: titleFromLink(link, titleFromUrl(url)), url, coverUrl: imageUrl(selectOne('img', item), source.siteUrl) } satisfies PrimeNovel];
  });
}

function parsePawReadSearch(source: PrimeSourceDefinition, html: string) {
  const root = parseDocument(html);
  return nodes(root, '.UpdateList .clearfix.itemBox').flatMap((item) => {
    const link = selectOne('.itemTxt .title a, a[href*="/novel/"]', item);
    const url = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    if (!link || !url) return [];
    return [{ id: novelId(source.id, url), sourceId: source.id, title: titleFromLink(link, titleFromUrl(url)), url, coverUrl: imageUrl(selectOne('.itemImg img, img', item), source.siteUrl) } satisfies PrimeNovel];
  });
}

function parseReadFromNetSearch(source: PrimeSourceDefinition, html: string) {
  const root = parseDocument(html);
  return nodes(root, '.box_in article').flatMap((item) => {
    const link = selectOne('h2 a', item) ?? selectOne('a[href]', item);
    const url = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    if (!link || !url) return [];
    return [{ id: novelId(source.id, url), sourceId: source.id, title: titleFromLink(selectOne('h2 b, h2', item) ?? link, titleFromUrl(url)), url, coverUrl: imageUrl(selectOne('img', item), source.siteUrl) } satisfies PrimeNovel];
  });
}

function parseReadNovelFullSearch(source: PrimeSourceDefinition, html: string) {
  const root = parseDocument(html);
  return nodes(root, '.archive .list .row').flatMap((item) => {
    const link = selectOne('.novel-title a, .truyen-title a, .tit a, a[href]', item);
    const url = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    if (!link || !url) return [];
    return [{ id: novelId(source.id, url), sourceId: source.id, title: titleFromLink(link, titleFromUrl(url)), url, coverUrl: imageUrl(selectOne('img', item), source.siteUrl) } satisfies PrimeNovel];
  });
}

function forumThreadUrl(url: string) {
  return url.replace(/\/page-\d+(?:#.*)?$/i, '').replace(/#.*$/, '');
}

function parseSufficientVelocitySearch(source: PrimeSourceDefinition, html: string) {
  const root = parseDocument(html);
  const seen = new Set<string>();
  return nodes(root, '.contentRow').flatMap((item) => {
    const link = selectOne('.contentRow-title a[href*="/threads/"]', item);
    const rawUrl = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    const url = rawUrl ? forumThreadUrl(rawUrl) : undefined;
    if (!link || !url || seen.has(url)) return [];
    seen.add(url);
    return [{ id: novelId(source.id, url), sourceId: source.id, title: titleFromLink(link, titleFromUrl(url)), url } satisfies PrimeNovel];
  });
}

function forumPostParagraphs(root: AnyNode, postSelector: string) {
  const post = firstNode(root, [postSelector]);
  const wrapper = post ? firstNode(post, ['.bbWrapper', '.message-body']) : undefined;
  if (!wrapper) return [];
  const html = DomUtils.getOuterHTML(wrapper)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return DomUtils.textContent(parseDocument(html))
    .split(/\n+/)
    .map((paragraph: string) => normalizeText(paragraph))
    .filter(Boolean);
}

function parseSufficientVelocityDetails(source: PrimeSourceDefinition, html: string, url: string) {
  const root = parseDocument(html);
  const novel: PrimeNovel = {
    id: novelId(source.id, url),
    sourceId: source.id,
    title: nodeText(firstNode(root, ['h1.p-title-value', '.p-title-value', 'h1'])) || titleFromUrl(url),
    url,
    author: nodeText(firstNode(root, ['article.js-post .message-name a', '.message-name a'])),
    description: forumPostParagraphs(root, 'article.js-post').slice(0, 3).join(' '),
  };
  const chapters = nodes(root, 'article.js-post').flatMap((post, index) => {
    const postId = nodeAttribute(post, 'data-content') ?? nodeAttribute(post, 'id')?.replace(/^js-/, '');
    if (!postId) return [];
    const postUrl = `${url}#${postId}`;
    const title = titleFromLink(firstNode(post, ['.bbWrapper h1', '.bbWrapper h2', '.bbWrapper h3']), `Post ${index + 1}`);
    return [{ id: chapterId(novel, postUrl), novelId: novel.id, number: index + 1, title, url: postUrl } satisfies PrimeChapter];
  });
  return { ...novel, chapterCount: chapters.length, chapters } satisfies PrimeNovelDetails;
}

function parseKnoxTSearch(source: PrimeSourceDefinition, html: string) {
  const root = parseDocument(html);
  return nodes(root, '.listupd article').flatMap((item) => {
    const link = selectOne('h2 a, .ntitle a, a[href]', item);
    const url = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    if (!link || !url) return [];
    return [{
      id: novelId(source.id, url),
      sourceId: source.id,
      title: titleFromLink(link, titleFromUrl(url)),
      url,
      coverUrl: imageUrl(selectOne('img', item), source.siteUrl),
      description: nodeText(selectOne('.contexcerpt', item)) || undefined,
    } satisfies PrimeNovel];
  });
}

function parseKnoxTDetails(source: PrimeSourceDefinition, html: string, url: string) {
  const root = parseDocument(html);
  const novel: PrimeNovel = {
    id: novelId(source.id, url),
    sourceId: source.id,
    title: nodeText(firstNode(root, ['.entry-title', 'h1'])) || titleFromUrl(url),
    url,
    author: nodes(root, '.spe > span:nth-child(3) a').map((item) => nodeText(item)).filter(Boolean).join(', ') || undefined,
    coverUrl: imageUrl(firstNode(root, ['.thumb img', '.summary_image img', 'img']), source.siteUrl),
    description: nodeText(firstNode(root, ['.entry-content', '.description'])) || undefined,
    genres: nodes(root, '.genxed a, .genres-content a').map((item) => nodeText(item)).filter(Boolean),
    status: nodeText(firstNode(root, ['.spe > span:nth-child(1)', '.status'])) || undefined,
  };
  const links = nodes(root, '.eplister.eplisterfull li a');
  const chapters = [...links].reverse().flatMap((link, index) => {
    const chapterUrl = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    if (!chapterUrl) return [];
    const number = nodeText(selectOne('.epl-num', link)) || String(index + 1);
    const chapterTitle = nodeText(selectOne('.epl-title', link)) || titleFromLink(link, `Chapter ${index + 1}`);
    return [{
      id: chapterId(novel, chapterUrl),
      novelId: novel.id,
      number: index + 1,
      title: `[${number}] ${chapterTitle}`,
      url: chapterUrl,
    } satisfies PrimeChapter];
  });
  return { ...novel, chapterCount: chapters.length, chapters } satisfies PrimeNovelDetails;
}

type GenesisNovelRecord = {
  id?: string;
  novel_title?: string;
  slug?: string;
  abbreviation?: string;
  synopsis?: string;
  coverFile?: { filename_disk?: string };
  author?: string;
  serialization?: string;
  genres?: Array<{ name?: string; genres_id?: number }>;
  tags?: Array<{ name?: string; slug?: string }>;
};

type GenesisChapterRecord = {
  id?: number | string;
  chapter_number?: number;
  chapter_title?: string;
  date_published?: string;
  isPaid?: boolean;
  isUnlocked?: boolean;
};

function genesisApiUrl(path: string, params?: Record<string, string>) {
  const url = new URL(path, 'https://genesistudio.com');
  Object.entries(params ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

function genesisCoverUrl(record: GenesisNovelRecord) {
  const filename = record.coverFile?.filename_disk;
  return filename
    ? `https://genesistudio.com/cdn-cgi/image/width=256,format=avif/https://api.genesistudio.com/storage/v1/object/public/directus/${filename}`
    : undefined;
}

function genesisSlugFromUrl(url: string) {
  try {
    return new URL(url).pathname.match(/\/novels\/([^/]+)/)?.[1];
  } catch {
    return undefined;
  }
}

function genesisNovelUrl(source: PrimeSourceDefinition, slug: string) {
  return `${source.siteUrl.replace(/\/$/, '')}/novels/${slug}`;
}

function parseGenesisSearch(source: PrimeSourceDefinition, records: GenesisNovelRecord[]) {
  return records.flatMap((record) => {
    const slug = record.slug ?? record.abbreviation;
    if (!slug || !record.novel_title) return [];
    const url = genesisNovelUrl(source, slug);
    return [{
      id: novelId(source.id, url),
      sourceId: source.id,
      sourceRecordId: record.id,
      title: record.novel_title,
      url,
      coverUrl: genesisCoverUrl(record),
      description: record.synopsis ? nodeText(parseDocument(record.synopsis)) : undefined,
      author: record.author || undefined,
      status: record.serialization || undefined,
      genres: record.genres?.map((genre) => genre.name).filter((genre): genre is string => Boolean(genre)),
    } satisfies PrimeNovel];
  }).slice(0, 40);
}

function genesisChapterList(data: { data?: { chapters?: GenesisChapterRecord[] } } | GenesisChapterRecord[]) {
  return Array.isArray(data) ? data : data.data?.chapters ?? [];
}

function parseGenesisDetails(source: PrimeSourceDefinition, novel: PrimeNovel, record: GenesisNovelRecord, chapterData: GenesisChapterRecord[]) {
  const slug = record.slug ?? record.abbreviation ?? genesisSlugFromUrl(novel.url);
  const details: PrimeNovel = {
    ...novel,
    title: record.novel_title ?? novel.title,
    author: record.author || novel.author,
    coverUrl: genesisCoverUrl(record) ?? novel.coverUrl,
    description: record.synopsis ? nodeText(parseDocument(record.synopsis)) : novel.description,
    status: record.serialization || novel.status,
    genres: record.genres?.map((genre) => genre.name).filter((genre): genre is string => Boolean(genre)) ?? novel.genres,
  };
  const chapters = chapterData
    .filter((chapter) => chapter.id !== undefined && chapter.chapter_number !== undefined && (!chapter.isPaid || chapter.isUnlocked))
    .sort((left, right) => (left.chapter_number ?? 0) - (right.chapter_number ?? 0))
    .flatMap((chapter) => {
      if (!slug || chapter.id === undefined || chapter.chapter_number === undefined) return [];
      const chapterUrl = `${genesisNovelUrl(source, slug)}/chapter-${chapter.chapter_number}`;
      return [{
        id: chapterId(details, chapterUrl),
        novelId: details.id,
        number: chapter.chapter_number,
        title: chapter.chapter_title || `Chapter ${chapter.chapter_number}`,
        url: chapterUrl,
        releaseDate: chapter.date_published?.slice(0, 10),
      } satisfies PrimeChapter];
    });
  return { ...details, chapterCount: chapters.length, chapters } satisfies PrimeNovelDetails;
}

function parseXenforoSearch(source: PrimeSourceDefinition, html: string) {
  const root = parseDocument(html);
  const seen = new Set<string>();
  return nodes(root, '.block-body .contentRow').flatMap((item) => {
    const link = selectOne('.contentRow-title a[href*="/threads/"]', item);
    const rawUrl = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    const url = rawUrl ? forumThreadUrl(rawUrl) : undefined;
    if (!link || !url || seen.has(url)) return [];
    seen.add(url);
    return [{
      id: novelId(source.id, url),
      sourceId: source.id,
      title: titleFromLink(link, titleFromUrl(url)),
      url,
      coverUrl: imageUrl(selectOne('.contentRow-figure img', item), source.siteUrl),
      author: nodeText(selectOne('a.username', item)) || undefined,
      genres: nodes(item, '.js-tagList a').map((tag) => nodeText(tag)).filter(Boolean),
    } satisfies PrimeNovel];
  });
}

function parseXenforoDetails(source: PrimeSourceDefinition, html: string, url: string) {
  const root = parseDocument(html);
  const novel: PrimeNovel = {
    id: novelId(source.id, url),
    sourceId: source.id,
    title: nodeText(firstNode(root, ['.p-title-value', 'h1'])) || titleFromUrl(url),
    url,
    author: nodeText(firstNode(root, ['.threadmarkListingHeader .username', '.p-description a.username', 'article.js-post .username'])) || undefined,
    coverUrl: imageUrl(firstNode(root, ['.threadmarkListingHeader-icon img', 'article.js-post .avatar img']), source.siteUrl),
    description: nodeText(firstNode(root, ['.threadmarkListingHeader-extraInfo .bbWrapper', 'meta[name="description"]'])) || undefined,
    genres: nodes(root, '.threadmarkListingHeader-tags a, .js-tagList a').map((tag) => nodeText(tag)).filter(Boolean),
  };
  const rows = nodes(root, '.structItemContainer .structItem');
  const chapters = rows.flatMap((row, index) => {
    const link = selectOne('.structItem-title a', row);
    const chapterUrl = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    if (!chapterUrl) return [];
    return [{
      id: chapterId(novel, chapterUrl),
      novelId: novel.id,
      number: index + 1,
      title: titleFromLink(link, `Chapter ${index + 1}`),
      url: chapterUrl,
      releaseDate: nodeAttribute(selectOne('time.structItem-latestDate', row), 'datetime')?.slice(0, 10),
    } satisfies PrimeChapter];
  });
  return { ...novel, chapterCount: chapters.length, chapters } satisfies PrimeNovelDetails;
}

function parseLightNovelsTranslationsSearch(source: PrimeSourceDefinition, html: string) {
  const root = parseDocument(html);
  return nodes(root, 'section.read_list-story .wrap_read_list-story > .read_list-story-item').flatMap((item) => {
    const link = selectOne('.read_list-story-item--title a', item);
    const rawUrl = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    const url = rawUrl ? stripUrlQuery(rawUrl) : undefined;
    if (!link || !url) return [];
    return [{ id: novelId(source.id, url), sourceId: source.id, title: titleFromLink(link, titleFromUrl(url)), url, coverUrl: imageUrl(selectOne('.item_thumb img', item), source.siteUrl) } satisfies PrimeNovel];
  });
}

function parseLightNovelsTranslationsDetails(source: PrimeSourceDefinition, html: string, url: string) {
  const root = parseDocument(html);
  const novel: PrimeNovel = {
    id: novelId(source.id, url),
    sourceId: source.id,
    title: nodeText(firstNode(root, ['.novel_title', 'h1'])) || titleFromUrl(url),
    url,
    coverUrl: imageUrl(firstNode(root, ['.novel-image img', 'img']), source.siteUrl),
    description: nodeText(firstNode(root, ['#about .novel_text', '.novel_text'])) || undefined,
    status: nodeText(firstNode(root, ['.novel_status', '.status'])) || undefined,
    genres: nodes(root, '.novel_tags_item > span').map((tag) => nodeText(tag)).filter(Boolean),
    author: nodes(root, '.novel_detail_info > ul > li').map((item) => nodeText(item)).find((value) => /^author:/i.test(value))?.replace(/^author:\s*/i, ''),
  };
  const chapters = nodes(root, '.novel_list_chapter_content .chapter-item a, .chapter-item a').flatMap((link, index) => {
    const chapterUrl = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    const className = nodeAttribute(link.parent as Element | null, 'class') ?? '';
    if (!chapterUrl || (/lock/i.test(className) && !/unlock/i.test(className))) return [];
    return [{ id: chapterId(novel, chapterUrl), novelId: novel.id, number: index + 1, title: titleFromLink(link, `Chapter ${index + 1}`), url: chapterUrl } satisfies PrimeChapter];
  });
  return { ...novel, chapterCount: chapters.length, chapters } satisfies PrimeNovelDetails;
}

function parseSoafpSearch(source: PrimeSourceDefinition, html: string) {
  const root = parseDocument(html);
  return nodes(root, '.search-results li.search-result-item').flatMap((item) => {
    const link = selectOne('a.search-result-link', item);
    const url = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    if (!link || !url) return [];
    return [{ id: novelId(source.id, url), sourceId: source.id, title: titleFromLink(selectOne('.search-result-title', item) ?? link, titleFromUrl(url)), url, coverUrl: imageUrl(selectOne('.search-result-cover img', item), source.siteUrl), description: nodeText(selectOne('.search-result-synopsis', item)) || undefined } satisfies PrimeNovel];
  });
}

function parseSoafpDetails(source: PrimeSourceDefinition, html: string, url: string) {
  const root = parseDocument(html);
  const novel: PrimeNovel = {
    id: novelId(source.id, url),
    sourceId: source.id,
    title: nodeText(firstNode(root, ['#primary article .entry-title', 'h1'])) || titleFromUrl(url),
    url,
    coverUrl: imageUrl(firstNode(root, ['#primary article .wp-block-image img', 'article img']), source.siteUrl),
    description: nodes(root, 'article .entry-synopsis > p, article .entry-content > p').map((item) => nodeText(item)).filter(Boolean).join(' ') || undefined,
    genres: nodes(root, '.entry-details .genres-links > a').map((item) => nodeText(item)).filter(Boolean),
  };
  const chapters = nodes(root, '.chapter-list li a, .lcp_catlist li a, article .entry-content a[href*="/novel/"]').flatMap((link, index) => {
    const chapterUrl = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    if (!chapterUrl || stripUrlQuery(chapterUrl) === stripUrlQuery(url)) return [];
    return [{ id: chapterId(novel, chapterUrl), novelId: novel.id, number: index + 1, title: titleFromLink(link, `Chapter ${index + 1}`), url: chapterUrl } satisfies PrimeChapter];
  });
  return { ...novel, chapterCount: chapters.length, chapters } satisfies PrimeNovelDetails;
}

type DragonholicSearchRecord = { title?: string; url?: string; thumbnail?: string; excerpt?: string };
type DragonholicChapter = { id?: string; name?: string; slug?: string; chapter_order?: string | number; is_premium?: boolean; created_at?: string };

function parseDragonholicSearch(source: PrimeSourceDefinition, data: { results?: DragonholicSearchRecord[] }) {
  return (data.results ?? []).flatMap((record) => {
    const url = absoluteUrl(record.url, source.siteUrl);
    if (!url || !record.title) return [];
    return [{ id: novelId(source.id, url), sourceId: source.id, title: record.title, url, coverUrl: record.thumbnail, description: record.excerpt } satisfies PrimeNovel];
  });
}

function parseDragonholicDetails(source: PrimeSourceDefinition, html: string, novel: PrimeNovel, chaptersData: DragonholicChapter[]) {
  const root = parseDocument(html);
  const details: PrimeNovel = {
    ...novel,
    title: nodeText(firstNode(root, ['h1', '.entry-title'])) || novel.title,
    coverUrl: imageUrl(firstNode(root, ['.summary_image img', 'img']), source.siteUrl) ?? novel.coverUrl,
    description: nodes(root, '.prose p').map((item) => nodeText(item)).filter(Boolean).join(' ') || novel.description,
    genres: nodes(root, '.genres a, .genre a').map((item) => nodeText(item)).filter(Boolean),
  };
  const chapters = chaptersData
    .filter((chapter) => chapter.slug && chapter.chapter_order !== undefined && !chapter.is_premium)
    .sort((left, right) => Number(left.chapter_order) - Number(right.chapter_order))
    .flatMap((chapter) => {
      if (!chapter.slug || chapter.chapter_order === undefined) return [];
      const chapterUrl = `${novel.url.replace(/\/$/, '')}/${chapter.slug}/`;
      return [{ id: chapterId(details, chapterUrl), novelId: details.id, number: Number(chapter.chapter_order), title: chapter.name || `Chapter ${chapter.chapter_order}`, url: chapterUrl, releaseDate: chapter.created_at?.slice(0, 10) } satisfies PrimeChapter];
    });
  return { ...details, chapterCount: chapters.length, chapters } satisfies PrimeNovelDetails;
}

function parseWuxiaClickSearch(source: PrimeSourceDefinition, html: string) {
  const root = parseDocument(html);
  return nodes(root, '.mantine-Grid-root > div > div > a').flatMap((item) => {
    const url = absoluteUrl(nodeAttribute(item, 'href'), source.siteUrl);
    if (!url) return [];
    const title = nodeText(firstNode(item, ['div[data-last="true"] .mantine-Text-root', '[data-last="true"] .mantine-Text-root'])) || titleFromUrl(url);
    return [{ id: novelId(source.id, url), sourceId: source.id, title, url, coverUrl: imageUrl(selectOne('img', item), source.siteUrl) } satisfies PrimeNovel];
  });
}

function parseWuxiaClickDetails(source: PrimeSourceDefinition, html: string, url: string, chapters: Array<{ id?: number; index?: number; title?: string; novSlugChapSlug?: string; timeAdded?: string }>) {
  const root = parseDocument(html);
  const title = nodes(root, '.mantine-Title-root').map((item) => nodeText(item)).find((value) => value && value !== 'WuxiaClick') || titleFromUrl(url);
  const novel: PrimeNovel = {
    id: novelId(source.id, url),
    sourceId: source.id,
    title,
    url,
    coverUrl: imageUrl(firstNode(root, ['.mantine-Image-image', 'img']), source.siteUrl),
    description: nodeText(firstNode(root, ['.mantine-Spoiler-content'])) || undefined,
  };
  const parsedChapters = chapters.flatMap((chapter, index) => {
    if (!chapter.novSlugChapSlug) return [];
    const chapterUrl = `${source.siteUrl.replace(/\/$/, '')}/chapter/${chapter.novSlugChapSlug}`;
    return [{ id: chapterId(novel, chapterUrl), novelId: novel.id, number: chapter.index ?? index + 1, title: chapter.title || `Chapter ${chapter.index ?? index + 1}`, url: chapterUrl, releaseDate: chapter.timeAdded } satisfies PrimeChapter];
  }).sort((left, right) => left.number - right.number);
  return { ...novel, chapterCount: parsedChapters.length, chapters: parsedChapters } satisfies PrimeNovelDetails;
}

type GutenbergBookRecord = {
  id?: number;
  title?: string;
  authors?: Array<{ name?: string }>;
  summaries?: string[];
  subjects?: string[];
  bookshelves?: string[];
  formats?: Record<string, string>;
};

function gutenbergTextUrl(record: GutenbergBookRecord) {
  return record.formats?.['text/plain; charset=utf-8'] ?? record.formats?.['text/plain'] ?? record.formats?.['text/html'];
}

function gutenbergGenres(record: GutenbergBookRecord) {
  return [...(record.subjects ?? []), ...(record.bookshelves ?? [])]
    .map((value) => normalizeText(value.replace(/^category:\s*/i, '').replace(/\s+--\s+.*/, '')))
    .filter(Boolean)
    .slice(0, 12);
}

function parseGutenbergNovel(source: PrimeSourceDefinition, record: GutenbergBookRecord, fallback?: PrimeNovel) {
  const id = record.id ?? Number(fallback?.sourceRecordId);
  const textUrl = gutenbergTextUrl(record) ?? fallback?.url;
  if (!id || !textUrl) return undefined;
  const novel: PrimeNovel = {
    id: novelId(source.id, `${source.siteUrl}/ebooks/${id}`),
    sourceId: source.id,
    sourceRecordId: String(id),
    title: record.title ?? fallback?.title ?? `Project Gutenberg ${id}`,
    url: `${source.siteUrl}/ebooks/${id}`,
    author: record.authors?.map((author) => author.name).filter(Boolean).join(', ') || fallback?.author,
    coverUrl: record.formats?.['image/jpeg'] ?? fallback?.coverUrl,
    description: record.summaries?.[0] ?? fallback?.description,
    genres: gutenbergGenres(record),
  };
  const chapter = {
    id: chapterId(novel, textUrl),
    novelId: novel.id,
    number: 1,
    title: 'Complete book',
    url: textUrl,
  } satisfies PrimeChapter;
  return { ...novel, chapterCount: 1, chapters: [chapter] } satisfies PrimeNovelDetails;
}

type WikisourceSearchRecord = {
  pageid?: number;
  title?: string;
  snippet?: string;
};

type WikisourceSearchResponse = {
  query?: {
    search?: WikisourceSearchRecord[];
  };
};

type WikisourceParseResponse = {
  parse?: {
    pageid?: number;
    title?: string;
    displaytitle?: string;
    text?: string;
  };
};

function wikisourceApiUrl(source: PrimeSourceDefinition, params: Record<string, string>) {
  const query = new URLSearchParams({
    format: 'json',
    formatversion: '2',
    origin: '*',
    ...params,
  });
  return `${source.siteUrl}/w/api.php?${query.toString()}`;
}

function wikisourcePageTitle(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\/wiki\//, '')).replace(/_/g, ' ');
  } catch {
    return '';
  }
}

function wikisourcePageUrl(source: PrimeSourceDefinition, title: string) {
  return `${source.siteUrl}/wiki/${encodeURIComponent(title).replace(/%2F/g, '/')}`;
}

function cleanWikisourceText(html: string) {
  const root = parseDocument(html);
  return nodes(root, '.mw-parser-output p, .mw-parser-output blockquote')
    .map((paragraph) => nodeText(paragraph))
    .filter((paragraph) => paragraph.length > 0);
}

function parseWikisourceSearch(source: PrimeSourceDefinition, data: WikisourceSearchResponse) {
  return (data.query?.search ?? []).flatMap((record) => {
    const title = normalizeText(record.title);
    if (!title || title.includes('/')) return [];
    const url = wikisourcePageUrl(source, title);
    return [{
      id: novelId(source.id, url),
      sourceId: source.id,
      sourceRecordId: record.pageid ? String(record.pageid) : undefined,
      title,
      url,
      description: record.snippet ? nodeText(parseDocument(record.snippet)) : undefined,
      genres: ['Classics', 'Literature'],
    } satisfies PrimeNovel];
  }).slice(0, 40);
}

function parseWikisourceDetails(source: PrimeSourceDefinition, novel: PrimeNovel, data: WikisourceParseResponse) {
  const parsed = data.parse;
  const pageTitle = normalizeText(parsed?.displaytitle ?? parsed?.title ?? novel.title).replace(/<[^>]+>/g, '');
  const root = parseDocument(parsed?.text ?? '');
  const seen = new Set<string>();
  const chapters = nodes(root, '.mw-parser-output a[href^="/wiki/"]').flatMap((link, index) => {
    const href = nodeAttribute(link, 'href');
    const chapterUrl = absoluteUrl(href, source.siteUrl);
    const chapterTitle = chapterUrl ? wikisourcePageTitle(chapterUrl) : '';
    if (!chapterUrl || !chapterTitle.startsWith(`${pageTitle}/`) || seen.has(chapterUrl)) return [];
    seen.add(chapterUrl);
    return [{
      id: chapterId(novel, chapterUrl),
      novelId: novel.id,
      number: index + 1,
      title: chapterTitle.slice(pageTitle.length + 1),
      url: chapterUrl,
    } satisfies PrimeChapter];
  });
  const fallbackChapter = {
    id: chapterId(novel, novel.url),
    novelId: novel.id,
    number: 1,
    title: 'Complete text',
    url: novel.url,
  } satisfies PrimeChapter;
  return {
    ...novel,
    title: pageTitle || novel.title,
    chapterCount: chapters.length || 1,
    chapters: chapters.length > 0 ? chapters : [fallbackChapter],
  } satisfies PrimeNovelDetails;
}

type LocResource = {
  text_file?: string;
  fulltext_file?: string;
  fulltext_derivative?: string;
  image?: string;
  pdf?: string;
};

type LocRecord = {
  id?: string;
  title?: string;
  contributor?: string[];
  contributor_names?: string[];
  description?: string[];
  image_url?: string[];
  online_format?: string[];
  original_format?: string[];
  subject?: string[];
  genre?: string[];
  rights?: string[];
  access_restricted?: boolean;
  resources?: LocResource[];
  item?: LocRecord;
};

type LocSearchResponse = {
  content?: {
    results?: LocRecord[];
  };
};

function locRecordId(record: LocRecord, fallback?: PrimeNovel) {
  const value = record.id ?? fallback?.sourceRecordId ?? '';
  try {
    const path = new URL(value, 'https://www.loc.gov').pathname;
    const match = path.match(/\/item\/([^/]+)/);
    return match?.[1] ?? value.replace(/^\/+|\/+$/g, '');
  } catch {
    return value;
  }
}

function locTextUrl(record: LocRecord) {
  const plainTextResource = record.resources?.find((resource) => resource.text_file || resource.fulltext_file);
  return plainTextResource?.text_file
    ?? plainTextResource?.fulltext_file
    ?? record.resources?.find((resource) => resource.fulltext_derivative)?.fulltext_derivative;
}

function parseLocNovel(source: PrimeSourceDefinition, record: LocRecord, fallback?: PrimeNovel) {
  const item = record.item ?? record;
  const textUrl = locTextUrl(record) ?? locTextUrl(item) ?? fallback?.url;
  const id = locRecordId(record, fallback);
  if (!id || !textUrl) return undefined;
  const itemTitle = Array.isArray(item.title) ? item.title[0] : item.title;
  const title = normalizeText(itemTitle ?? record.title ?? fallback?.title).replace(/,$/, '') || `Library of Congress item ${id}`;
  const authors = item.contributor_names ?? item.contributor ?? record.contributor_names ?? record.contributor ?? [];
  const subjects = [...(item.genre ?? []), ...(item.subject ?? []), ...(record.genre ?? []), ...(record.subject ?? [])]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .slice(0, 12);
  const novel: PrimeNovel = {
    id: novelId(source.id, `${source.siteUrl}/item/${id}/`),
    sourceId: source.id,
    sourceRecordId: id,
    title,
    url: `${source.siteUrl}/item/${id}/`,
    author: authors.map((author) => normalizeText(author)).filter(Boolean).join(', ') || fallback?.author,
    coverUrl: record.image_url?.[0] ?? item.image_url?.[0] ?? fallback?.coverUrl,
    description: record.description?.[0] ?? item.description?.[0] ?? fallback?.description,
    genres: subjects.length > 0 ? subjects : ['Library collections'],
  };
  const chapter = {
    id: chapterId(novel, textUrl),
    novelId: novel.id,
    number: 1,
    title: 'Complete text',
    url: textUrl,
  } satisfies PrimeChapter;
  return { ...novel, chapterCount: 1, chapters: [chapter] } satisfies PrimeNovelDetails;
}

function locRightsText(record: LocRecord) {
  const item = record.item ?? record;
  return [...(record.rights ?? []), ...(item.rights ?? [])].join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function locAllowsInternalReading(record: LocRecord) {
  const rights = locRightsText(record).toLocaleLowerCase();
  if (!rights) return false;
  return /public domain|free to use and reuse|creative commons|cc0|no known copyright restrictions|u\.s\. government work/.test(rights);
}

function cleanLocText(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\f+|\n\s*\n+/)
    .map((paragraph) => normalizeText(paragraph))
    .filter((paragraph) => paragraph.length > 0);
}

function decodeAfricanValue(value: string) {
  return normalizeText(DomUtils.textContent(parseDocument(value.replace(/\\(["'\\])/g, '$1'))));
}

function africanField(record: string, field: string) {
  const marker = `${field}:"`;
  const start = record.indexOf(marker);
  if (start < 0) return '';
  const value = record.slice(start + marker.length).match(/^(?:\\.|[^"\\])*/)?.[0] ?? '';
  return decodeAfricanValue(value);
}

function parseAfricanStorybookSearch(source: PrimeSourceDefinition, script: string, query: string) {
  const normalizedQuery = normalizeText(query).toLocaleLowerCase();
  const records = script.split('parent.bookItemsAppr.push({').slice(1).flatMap((record) => {
    const recordText = record.split('});', 1)[0];
    const id = africanField(recordText, 'id');
    const title = africanField(recordText, 'title');
    const description = africanField(recordText, 'summary');
    const author = africanField(recordText, 'author');
    const searchable = `${title} ${description} ${author}`.toLocaleLowerCase();
    if (!id || !title || !searchable.includes(normalizedQuery)) return [];
    const url = `${source.siteUrl}/index.php?id=${encodeURIComponent(id)}`;
    return [{
      id: novelId(source.id, url),
      sourceId: source.id,
      sourceRecordId: id,
      title,
      url,
      author: author || undefined,
      coverUrl: `${source.siteUrl}/illustrations/covers/${encodeURIComponent(id)}.png`,
      description: description || undefined,
      genres: ['African literature', 'Children', 'Community published'],
    } satisfies PrimeNovel];
  });
  return records.slice(0, 40);
}

function parseAfricanStorybookDetails(source: PrimeSourceDefinition, novel: PrimeNovel) {
  const id = novel.sourceRecordId;
  if (!id) return { ...novel, chapterCount: 0, chapters: [] } satisfies PrimeNovelDetails;
  const chapterUrl = `${source.siteUrl}/read/readbook.php?id=${encodeURIComponent(id)}&d=0&a=0`;
  const chapter = { id: chapterId(novel, chapterUrl), novelId: novel.id, number: 1, title: 'Story', url: chapterUrl } satisfies PrimeChapter;
  return { ...novel, chapterCount: 1, chapters: [chapter] } satisfies PrimeNovelDetails;
}

function cleanGutenbergText(text: string) {
  const start = text.indexOf('*** START OF');
  const end = text.indexOf('*** END OF');
  const body = text.slice(start >= 0 ? text.indexOf('\n', start) + 1 : 0, end >= 0 ? end : undefined);
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n+/)
    .map((paragraph) => normalizeText(paragraph))
    .filter((paragraph) => paragraph.length > 0);
}

function africanStorybookCatalog(source: PrimeSourceDefinition, timeoutMs = REQUEST_TIMEOUT_MS) {
  const cached = africanStorybookCatalogCache.get(source.siteUrl);
  if (cached) return cached;
  const request = requestText(`${source.siteUrl}/lists/booklist.approved.php`, undefined, timeoutMs).catch((error: unknown) => {
    africanStorybookCatalogCache.delete(source.siteUrl);
    throw error;
  });
  africanStorybookCatalogCache.set(source.siteUrl, request);
  return request;
}

async function searchSource(source: PrimeSourceDefinition, query: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<PrimeNovel[]> {
  const encodedQuery = encodeURIComponent(query.trim());
  switch (source.adapter) {
    case 'royal-road':
      return parseRoyalRoadSearch(source, await requestText(`${source.siteUrl}/fictions/search?keyword=${encodedQuery}&page=1`, undefined, timeoutMs));
    case 'novel-buddy': {
      const data = await requestJson<{ data?: { items?: Array<{ id?: string; name?: string; cover?: string; url?: string }> } }>(`https://api.novelbuddy.me/titles/search?q=${encodedQuery}&page=1`, undefined, timeoutMs);
      return (data.data?.items ?? []).flatMap((item) => {
        const url = absoluteUrl(item.url, source.siteUrl);
        if (!url || !item.name) return [];
        return [{ id: novelId(source.id, url), sourceId: source.id, sourceRecordId: item.id, title: item.name, url, coverUrl: item.cover } satisfies PrimeNovel];
      });
    }
    case 'wattpad': {
      const data = await requestJson<{ stories?: Array<{ title?: string; cover?: string; url?: string }> }>(`${source.siteUrl}/v4/search/stories?query=${encodedQuery}&free=1&fields=stories(title,cover,url),nexturl&limit=20&mature=true&offset=0`, undefined, timeoutMs);
      return parseWattpadSearch(source, data);
    }
    case 'asian-hobbyist': {
      const home = parseDocument(await requestText(source.siteUrl, undefined, timeoutMs));
      const encoding = nodeAttribute(firstNode(home, ['meta[name="enc"]']), 'content') ?? '';
      const body = new URLSearchParams({ action: 'gsr', enc: encoding, src: query });
      const ajaxHtml = await requestText(`${source.siteUrl}/wp-admin/admin-ajax.php`, { method: 'POST', body: body.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, timeoutMs);
      if (ajaxHtml.trim() !== 'Shit!') return parseAsianSearch(source, ajaxHtml);
      const latest = parseAsianSearch(source, DomUtils.getOuterHTML(home));
      const normalizedQuery = query.toLowerCase();
      return latest.filter((novel) => novel.title.toLowerCase().includes(normalizedQuery));
    }
    case 'read-from-net':
      return parseReadFromNetSearch(source, await requestText(`${source.siteUrl}/build_in_search/?q=${encodedQuery}`, undefined, timeoutMs));
    case 'creative-novels':
      return parseCreativeSearch(source, await requestText(`${source.siteUrl}/?s=${encodedQuery}`, undefined, timeoutMs));
    case 'paw-read':
      return parsePawReadSearch(source, await requestText(`${source.siteUrl}/search/?keywords=${encodedQuery}`, undefined, timeoutMs));
    case 'read-novel-full':
      return parseReadNovelFullSearch(source, await requestText(`${source.siteUrl}/novel-list/search?keyword=${encodedQuery}&page=1`, undefined, timeoutMs));
    case 'sufficient-velocity':
      return parseSufficientVelocitySearch(source, await requestText(`${source.siteUrl}/search/search?keywords=${encodedQuery}`, undefined, timeoutMs));
    case 'project-gutenberg': {
      const data = await requestJson<{ results?: GutenbergBookRecord[] }>(`https://gutendex.com/books?search=${encodedQuery}&languages=en`, undefined, timeoutMs);
      return (data.results ?? []).flatMap((record) => {
        const novel = parseGutenbergNovel(source, record);
        return novel ? [novel] : [];
      });
    }
    case 'wikisource': {
      const data = await requestJson<WikisourceSearchResponse>(wikisourceApiUrl(source, {
        action: 'query',
        list: 'search',
        srnamespace: '0',
        srprop: 'snippet',
        srsearch: `intitle:"${query.trim()}"`,
        srlimit: '40',
      }), undefined, timeoutMs);
      return parseWikisourceSearch(source, data);
    }
    case 'library-of-congress': {
      const data = await requestJson<LocSearchResponse>(`https://www.loc.gov/books/?q=${encodedQuery}&fo=json&c=20`, undefined, timeoutMs);
      return (data.content?.results ?? []).flatMap((record) => {
        if (record.access_restricted || !locTextUrl(record)) return [];
        const novel = parseLocNovel(source, record);
        return novel ? [novel] : [];
      });
    }
    case 'african-storybook':
      if (query.trim().length < 2) return [];
      return parseAfricanStorybookSearch(source, await africanStorybookCatalog(source, timeoutMs), query);
    case 'knox-t':
      return parseKnoxTSearch(source, await requestText(`${source.siteUrl}/page/1/?s=${encodedQuery}`, undefined, timeoutMs));
    case 'genesis-studio':
      return parseGenesisSearch(source, await requestJson<GenesisNovelRecord[]>(genesisApiUrl('/api/directus/novels', {
        'filter[novel_title][_contains]': query.trim(),
        limit: '-1',
      }), undefined, timeoutMs));
    case 'questionable-questing': {
      const forumIds = ['19', '20', '29', '12'];
      const results = await Promise.all(forumIds.map(async (forumId) => {
        const url = new URL('/search/1/', `${source.siteUrl.replace(/\/$/, '')}/`);
        url.search = new URLSearchParams({
          t: 'post',
          'c[child_nodes]': '1',
          'c[nodes][0]': forumId,
          'c[threadmark_categories][0]': '1',
          'c[title_only]': '1',
          o: 'relevance',
          g: '1',
          q: query,
        }).toString();
        return parseXenforoSearch(source, await requestText(url.toString(), undefined, timeoutMs));
      }));
      const seen = new Set<string>();
      return results.flat().filter((novel) => {
        if (seen.has(novel.url)) return false;
        seen.add(novel.url);
        return true;
      });
    }
    case 'light-novels-translations': {
      const url = new URL('/read/page/1/', `${source.siteUrl.replace(/\/$/, '')}/`);
      url.search = new URLSearchParams({ sort: 'most-recent', type: 'all', status: 'all' }).toString();
      return parseLightNovelsTranslationsSearch(source, await requestText(url.toString(), {
        method: 'POST',
        body: new URLSearchParams({ 'field-search': query, submit: '' }).toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }, timeoutMs));
    }
    case 'soafp-translations':
      return parseSoafpSearch(source, await requestText(`${source.siteUrl}/search/?title=${encodedQuery}`, undefined, timeoutMs));
    case 'dragonholic':
      return parseDragonholicSearch(source, await requestJson<{ results?: DragonholicSearchRecord[] }>(`${source.siteUrl}/api/search?q=${encodedQuery}&per_page=10&page=1&types%5B%5D=series`, undefined, timeoutMs));
    case 'wuxia-click':
      return parseWuxiaClickSearch(source, await requestText(`${source.siteUrl}/search/${encodedQuery}?page=1`, undefined, timeoutMs));
    case 'wuxia-world-site':
    case 'light-novel-heaven':
    case 'sleepy-translations':
      return parseMadaraSearch(source, await requestText(`${source.siteUrl}/page/1/?s=${encodedQuery}&post_type=wp-manga`, undefined, timeoutMs));
  }
}

function parseRoyalRoadDetails(source: PrimeSourceDefinition, html: string, url: string) {
  const root = parseDocument(html);
  const titleNode = firstNode(root, ['.fic-header .fic-title h1', '.fic-title h1', 'h1']);
  const title = nodeText(titleNode) || 'Untitled';
  const novel: PrimeNovel = {
    id: novelId(source.id, url),
    sourceId: source.id,
    title,
    url,
    author: nodeText(firstNode(root, ['.fic-header .fic-title h4 a', '.fic-title h4 a'])),
    coverUrl: imageUrl(firstNode(root, ['.fic-header img', '.fic-header a img']), source.siteUrl),
    description: nodeText(firstNode(root, ['.fiction-info .description .hidden-content', '.description .hidden-content', '.description'])),
    genres: nodes(root, '.fiction-info .tags a, .tags a').map((item) => nodeText(item)).filter(Boolean),
  };
  let chapterNumber = 0;
  const chapters = nodes(root, '#chapters tbody tr, #chapters tr').flatMap((row) => {
    const link = selectOne('a[href]', row);
    const chapterUrl = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    if (!link || !chapterUrl) return [];
    chapterNumber += 1;
    return [{ id: chapterId(novel, chapterUrl), novelId: novel.id, number: chapterNumber, title: titleFromLink(link, `Chapter ${chapterNumber}`), url: chapterUrl, releaseDate: nodeText(selectOne('time', row)) } satisfies PrimeChapter];
  });
  return { ...novel, chapterCount: chapters.length, chapters } satisfies PrimeNovelDetails;
}

function parseNovelBuddyDetails(source: PrimeSourceDefinition, html: string, url: string) {
  const root = parseDocument(html);
  const jsonNode = firstNode(root, ['#__NEXT_DATA__']);
  let data: any = undefined;
  try {
    data = jsonNode ? JSON.parse(nodeText(jsonNode)) : undefined;
  } catch {
    data = undefined;
  }
  const novelData = data?.props?.pageProps?.initialManga;
  const novel: PrimeNovel = {
    id: novelId(source.id, url),
    sourceId: source.id,
    title: novelData?.name ?? nodeText(firstNode(root, ['h1', '.novel-title'])) ?? 'Untitled',
    url,
    author: Array.isArray(novelData?.authors) ? novelData.authors.map((author: { name?: string }) => author.name).filter(Boolean).join(', ') : undefined,
    coverUrl: novelData?.cover ?? imageUrl(firstNode(root, ['img.book-cover', 'img']), source.siteUrl),
    description: novelData?.summary ?? nodeText(firstNode(root, ['.summary', '.description'])),
    genres: Array.isArray(novelData?.genres) ? novelData.genres.map((genre: { name?: string }) => genre.name).filter(Boolean) : [],
    status: novelData?.status,
  };
  return { novel, novelIdFromSite: novelData?.id as string | number | undefined };
}

type NovelBuddyTitle = {
  id?: string;
  name?: string;
  cover?: string;
  summary?: string;
  status?: string;
  authors?: Array<{ name?: string }>;
  genres?: Array<{ name?: string }>;
};

function parseNovelBuddyApiDetails(source: PrimeSourceDefinition, novel: PrimeNovel, titleData: NovelBuddyTitle, chapterData: Array<{ name?: string; url?: string; date?: string }>) {
  const details: PrimeNovel = {
    ...novel,
    title: titleData.name ?? novel.title,
    author: titleData.authors?.map((author) => author.name).filter(Boolean).join(', ') || undefined,
    coverUrl: titleData.cover ?? novel.coverUrl,
    description: titleData.summary ? nodeText(parseDocument(titleData.summary)) : novel.description,
    genres: titleData.genres?.map((genre) => genre.name).filter((genre): genre is string => Boolean(genre)),
    status: titleData.status,
  };
  const chapters = [...chapterData].reverse().flatMap((item, index) => {
    const chapterUrl = absoluteUrl(item.url, source.siteUrl);
    if (!chapterUrl) return [];
    return [{
      id: chapterId(details, chapterUrl),
      novelId: details.id,
      number: index + 1,
      title: item.name ?? `Chapter ${index + 1}`,
      url: chapterUrl,
      releaseDate: item.date?.slice(0, 10),
    } satisfies PrimeChapter];
  });
  return { ...details, chapterCount: chapters.length, chapters } satisfies PrimeNovelDetails;
}

function parseGenericDetails(source: PrimeSourceDefinition, html: string, url: string) {
  const root = parseDocument(html);
  const title = nodeText(firstNode(root, ['h1.entry-title', '.title h1', '.novel-title', 'h1'])) || 'Untitled';
  const novel: PrimeNovel = {
    id: novelId(source.id, url),
    sourceId: source.id,
    title,
    url,
    author: nodeText(firstNode(root, ['[itemprop="author"]', '.author', '.novel-author', '.author a'])),
    coverUrl: imageUrl(firstNode(root, ['img.book_cover', '.book-cover img', '.cover img', '.thumb img', 'img']), source.siteUrl),
    description: nodeText(firstNode(root, ['.novel_page_synopsis', '.description', '.summary', '[itemprop="description"]', '.entry-content'])),
    genres: nodes(root, '.genre a, .genres a, .novel_tag_inner').map((item) => nodeText(item)).filter(Boolean),
    status: nodeText(firstNode(root, ['.novel_status', '.status', '[itemprop="availability"]'])),
  };
  const chapterNodes = nodes(root, '.chapter-list a, .chapters a, .chapter a, a[href*="chapter"], .row.flex.fn a');
  const seen = new Set<string>();
  const chapters = chapterNodes.flatMap((link, index) => {
    const chapterUrl = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    if (!chapterUrl || seen.has(chapterUrl)) return [];
    seen.add(chapterUrl);
    return [{ id: chapterId(novel, chapterUrl), novelId: novel.id, number: index + 1, title: titleFromLink(link, `Chapter ${index + 1}`), url: chapterUrl } satisfies PrimeChapter];
  });
  return { ...novel, chapterCount: chapters.length, chapters } satisfies PrimeNovelDetails;
}

function parseMadaraDetails(source: PrimeSourceDefinition, html: string, url: string) {
  const root = parseDocument(html);
  const novel: PrimeNovel = {
    id: novelId(source.id, url),
    sourceId: source.id,
    title: nodeText(firstNode(root, ['div.post-title h1', 'div.post-title', '.post-title', 'h1'])) || 'Untitled',
    url,
    author: nodeText(firstNode(root, ['.author-content a', '.author-content', '.author a'])),
    coverUrl: imageUrl(firstNode(root, ['div.summary_image img.img-responsive', 'div.summary_image img', '.summary_image img']), source.siteUrl),
    description: nodeText(firstNode(root, ['div.summary__content', 'div.manga-excerpt', '.summary_content'])),
    genres: nodes(root, '.genres-content a, .genres-content').map((item) => nodeText(item)).filter(Boolean),
    status: nodeText(firstNode(root, ['.post-status .summary-content', '.post-content_item .summary-content'])),
  };
  const chapters = parseMadaraChapterNodes(novel, root, source.siteUrl, false);
  return { ...novel, chapterCount: chapters.length, chapters } satisfies PrimeNovelDetails;
}

function parseMadaraChapterNodes(novel: PrimeNovel, root: AnyNode, baseUrl: string, reverse: boolean) {
  const chapterLinks = nodes(root, 'li.wp-manga-chapter a, .wp-manga-chapter a');
  const orderedLinks = reverse ? [...chapterLinks].reverse() : chapterLinks;
  return orderedLinks.flatMap((link, index) => {
    const url = absoluteUrl(nodeAttribute(link, 'href') ?? nodeAttribute(link, 'value'), baseUrl);
    if (!url) return [];
    return [{ id: chapterId(novel, url), novelId: novel.id, number: index + 1, title: titleFromLink(link, `Chapter ${index + 1}`), url } satisfies PrimeChapter];
  });
}

function chapterPath(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\/(series|novel)\/([^/]+)/i);
    return match ? { segment: match[1], slug: match[2] } : undefined;
  } catch {
    return undefined;
  }
}

async function loadMadaraChapters(source: PrimeSourceDefinition, novel: PrimeNovel) {
  const path = chapterPath(novel.url);
  if (!path) return [] as PrimeChapter[];
  const endpoint = `${source.siteUrl}/${path.segment}/${path.slug}/ajax/chapters/`;
  const html = await requestText(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: novel.url } });
  return parseMadaraChapterNodes(novel, parseDocument(html), source.siteUrl, true);
}

function parsePawReadDetails(source: PrimeSourceDefinition, html: string, url: string) {
  const root = parseDocument(html);
  const novel: PrimeNovel = {
    id: novelId(source.id, url),
    sourceId: source.id,
    title: nodeText(firstNode(root, ['h1', '.title'])) || 'Untitled',
    url,
    author: nodeText(firstNode(root, ['p.txtItme:nth-child(2)', '.txtItme'])),
    coverUrl: imageUrl(firstNode(root, ['#Cover img', '#Cover>img']), source.siteUrl),
    description: nodeText(firstNode(root, ['#full-des', '.description'])),
    genres: nodes(root, '.genre_list a').map((item) => nodeText(item)).filter(Boolean),
    status: nodeText(firstNode(root, ['.txtItme a', '.status'])),
  };
  const chapters = nodes(root, '.comic-chapters .chapter-warp li').flatMap((row, index) => {
    const item = selectOne('.item-box', row);
    const onclick = nodeAttribute(item, 'onclick');
    const link = onclick?.match(/['"](\/novel[^'"]+)['"]/)?.[1] ?? nodeAttribute(selectOne('a[href]', row), 'href');
    const chapterUrl = absoluteUrl(link, source.siteUrl);
    if (!chapterUrl) return [];
    return [{ id: chapterId(novel, chapterUrl), novelId: novel.id, number: index + 1, title: titleFromLink(selectOne('.item-box > div > span, a[href]', row), `Chapter ${index + 1}`), url: chapterUrl } satisfies PrimeChapter];
  });
  return { ...novel, chapterCount: chapters.length, chapters } satisfies PrimeNovelDetails;
}

function parseReadNovelFullDetails(source: PrimeSourceDefinition, html: string, url: string) {
  const root = parseDocument(html);
  const novel: PrimeNovel = {
    id: novelId(source.id, url),
    sourceId: source.id,
    title: nodeText(firstNode(root, ['.title', '.m-desc > .tit', 'h1'])) || 'Untitled',
    url,
    author: nodeText(firstNode(root, ['a[href*="/authors/"]', '.author', '.info a'])),
    coverUrl: imageUrl(firstNode(root, ['img.cover', '.pic img', 'div.book img', '.m-imgtxt img']), source.siteUrl),
    description: nodeText(firstNode(root, ['.desc-text', '.txt > .inner', '.description'])),
    genres: nodes(root, 'a[href*="/genres/"]').map((item) => nodeText(item)).filter(Boolean),
    status: nodeText(firstNode(root, ['.info .text-primary', '.status'])),
  };
  const chapters = nodes(root, '.m-newest2 > .ul-list5 > li > a, .list-chapter li a, li[data-chapter-item] a').flatMap((link, index) => {
    const chapterUrl = absoluteUrl(nodeAttribute(link, 'href') ?? nodeAttribute(link, 'data-href'), source.siteUrl);
    if (!chapterUrl) return [];
    return [{ id: chapterId(novel, chapterUrl), novelId: novel.id, number: index + 1, title: titleFromLink(link, `Chapter ${index + 1}`), url: chapterUrl } satisfies PrimeChapter];
  });
  return { ...novel, chapterCount: chapters.length, chapters } satisfies PrimeNovelDetails;
}

function parseReadFromNetDetails(source: PrimeSourceDefinition, html: string, url: string) {
  const root = parseDocument(html);
  const novel: PrimeNovel = {
    id: novelId(source.id, url),
    sourceId: source.id,
    title: nodeText(firstNode(root, ['.title', 'h1']))?.replace(/, page 1$/i, '') || 'Untitled',
    url,
    author: nodeText(firstNode(root, ['span[itemprop="author"]', 'li:last-of-type span[itemprop="name"]'])),
    coverUrl: firstAttribute(root, ['.box_in center .highslide'], 'href', source.siteUrl) ?? imageUrl(firstNode(root, ['.box_in img', 'img']), source.siteUrl),
    description: nodeText(firstNode(root, ['#description', '.description', '.text5'])),
  };
  const chapterLinks = nodes(root, '.splitnewsnavigation2.ignore-select .pages a');
  const chapters: PrimeChapter[] = [{ id: chapterId(novel, url), novelId: novel.id, number: 1, title: 'Chapter 1', url }];
  chapterLinks.forEach((link, index) => {
    const chapterUrl = absoluteUrl(nodeAttribute(link, 'href'), source.siteUrl);
    if (!chapterUrl || chapterUrl === url) return;
    chapters.push({ id: chapterId(novel, chapterUrl), novelId: novel.id, number: index + 2, title: titleFromLink(link, `Chapter ${index + 2}`), url: chapterUrl });
  });
  return { ...novel, chapterCount: chapters.length, chapters } satisfies PrimeNovelDetails;
}

async function getNovelDetails(source: PrimeSourceDefinition, novel: PrimeNovel): Promise<PrimeNovelDetails> {
  if (source.adapter === 'project-gutenberg' && novel.sourceRecordId) {
    const record = await requestJson<GutenbergBookRecord>(`https://gutendex.com/books/${encodeURIComponent(novel.sourceRecordId)}`);
    const details = parseGutenbergNovel(source, record, novel);
    if (details) return details;
  }
  if (source.adapter === 'african-storybook') return parseAfricanStorybookDetails(source, novel);
  if (source.adapter === 'wikisource') {
    const pageTitle = wikisourcePageTitle(novel.url);
    const data = await requestJson<WikisourceParseResponse>(wikisourceApiUrl(source, {
      action: 'parse',
      page: pageTitle,
      prop: 'text|displaytitle',
    }));
    return parseWikisourceDetails(source, novel, data);
  }
  if (source.adapter === 'library-of-congress') {
    const data = await requestJson<LocRecord>(`https://www.loc.gov/item/${encodeURIComponent(novel.sourceRecordId ?? '')}/?fo=json`);
    if (!locAllowsInternalReading(data)) throw new Error('This Library of Congress item is available for discovery, but not cleared for in-app reading.');
    const details = parseLocNovel(source, data, novel);
    if (details) return details;
  }
  if (source.adapter === 'novel-buddy' && novel.sourceRecordId) {
    const [titleResponse, chapterResponse] = await Promise.all([
      requestJson<{ data?: { title?: NovelBuddyTitle } }>(`https://api.novelbuddy.me/titles/${encodeURIComponent(novel.sourceRecordId)}`),
      requestJson<{ data?: { chapters?: Array<{ name?: string; url?: string; date?: string }> } }>(`https://api.novelbuddy.me/titles/${encodeURIComponent(novel.sourceRecordId)}/chapters`),
    ]);
    return parseNovelBuddyApiDetails(source, novel, titleResponse.data?.title ?? {}, chapterResponse.data?.chapters ?? []);
  }
  if (source.adapter === 'genesis-studio') {
    const slug = genesisSlugFromUrl(novel.url);
    const records = await requestJson<GenesisNovelRecord[]>(genesisApiUrl('/api/directus/novels', novel.sourceRecordId
      ? { 'filter[id]': novel.sourceRecordId, limit: '1' }
      : { 'filter[slug]': slug ?? '', limit: '1' }));
    const record = records[0];
    if (!record?.id) throw new Error('This Genesis Studio novel could not be loaded.');
    const chapterResponse = await requestJson<{ data?: { chapters?: GenesisChapterRecord[] } }>(`${source.siteUrl}/api/novels-chapter/${encodeURIComponent(record.id)}`);
    return parseGenesisDetails(source, novel, record, genesisChapterList(chapterResponse));
  }
  if (source.adapter === 'questionable-questing') {
    const threadmarksUrl = `${novel.url.replace(/\/$/, '')}/threadmarks?per_page=200`;
    return parseXenforoDetails(source, await requestText(threadmarksUrl), novel.url);
  }
  const html = await requestText(novel.url, source.adapter === 'wattpad' ? { headers: { Referer: 'https://www.wattpad.com/' } } : undefined);
  if (source.adapter === 'royal-road') return parseRoyalRoadDetails(source, html, novel.url);
  if (source.adapter === 'wattpad') return parseWattpadDetails(source, html, novel.url);
  if (source.adapter === 'knox-t') return parseKnoxTDetails(source, html, novel.url);

  if (source.adapter === 'wuxia-world-site' || source.adapter === 'light-novel-heaven' || source.adapter === 'sleepy-translations') {
    const details = parseMadaraDetails(source, html, novel.url);
    try {
      const chapters = await loadMadaraChapters(source, details);
      return { ...details, chapterCount: chapters.length, chapters };
    } catch {
      return details;
    }
  }

  if (source.adapter === 'paw-read') return parsePawReadDetails(source, html, novel.url);
  if (source.adapter === 'read-novel-full') return parseReadNovelFullDetails(source, html, novel.url);
  if (source.adapter === 'read-from-net') return parseReadFromNetDetails(source, html, novel.url);
  if (source.adapter === 'sufficient-velocity') return parseSufficientVelocityDetails(source, html, novel.url);
  if (source.adapter === 'light-novels-translations') {
    const detailsHtml = await requestText(`${novel.url}?tab=table_contents`);
    return parseLightNovelsTranslationsDetails(source, detailsHtml, novel.url);
  }
  if (source.adapter === 'soafp-translations') return parseSoafpDetails(source, html, novel.url);
  if (source.adapter === 'dragonholic') {
    const seriesId = html.match(/seriesId:\s*(\d+)/)?.[1];
    if (!seriesId) throw new Error('This Dragonholic series did not expose its chapter list.');
    const chapterResponse = await requestJson<{ chapters?: DragonholicChapter[] }>(`${source.siteUrl}/api/chapters?series_id=${seriesId}&sort_order=asc&per_page=1000000000`);
    return parseDragonholicDetails(source, html, novel, chapterResponse.chapters ?? []);
  }
  if (source.adapter === 'wuxia-click') {
    const slug = new URL(novel.url).pathname.match(/^\/novel\/([^/]+)/)?.[1];
    if (!slug) throw new Error('This WuxiaClick novel URL is invalid.');
    const chapters = await requestJson<Array<{ id?: number; index?: number; title?: string; novSlugChapSlug?: string; timeAdded?: string }>>(`${source.siteUrl}/api/chapters/${encodeURIComponent(slug)}`);
    return parseWuxiaClickDetails(source, html, novel.url, chapters);
  }
  if (source.adapter === 'novel-buddy') {
    const parsed = parseNovelBuddyDetails(source, html, novel.url);
    if (parsed.novelIdFromSite !== undefined) {
      const data = await requestJson<{ data?: { chapters?: Array<{ name?: string; url?: string; date?: string }> } }>(`https://api.novelbuddy.me/titles/${parsed.novelIdFromSite}/chapters`);
      const chapters = [...(data.data?.chapters ?? [])].reverse().flatMap((item, index) => {
        const chapterUrl = absoluteUrl(item.url, source.siteUrl);
        if (!chapterUrl) return [];
        return [{ id: chapterId(parsed.novel, chapterUrl), novelId: parsed.novel.id, number: index + 1, title: item.name ?? `Chapter ${index + 1}`, url: chapterUrl, releaseDate: item.date?.slice(0, 10) } satisfies PrimeChapter];
      });
      return { ...parsed.novel, chapterCount: chapters.length, chapters };
    }
  }

  return parseGenericDetails(source, html, novel.url);
}

function contentSelectors(adapter: PrimeSourceAdapterId) {
  switch (adapter) {
    case 'royal-road': return ['.chapter-page .chapter-content', '.chapter-content'];
    case 'novel-buddy': return ['.novel-reader-content .novel-tts-content', '.novel-tts-content'];
    case 'creative-novels': return ['div.entry-content.content', '.entry-content'];
    case 'asian-hobbyist': return ['div.entry-content'];
    case 'read-from-net': return ['#textToRead'];
    case 'paw-read': return ['.content'];
    case 'read-novel-full': return ['#chr-content', '#chapter-content', '.wp > .txt', 'article'];
    case 'wuxia-world-site':
    case 'light-novel-heaven':
    case 'sleepy-translations': return ['.c-blog-post .text-left', '.c-blog-post .text-left', '#chapter-content', '.text-left'];
    case 'light-novels-translations': return ['.text_story'];
    case 'soafp-translations': return ['article .entry-content', '.entry-content'];
    case 'dragonholic': return ['main .container > .border', '.prose'];
    case 'genesis-studio': return ['.novel-content'];
    case 'knox-t': return ['.epcontent.entry-content'];
    default: return ['article', '.entry-content', '.chapter-content', 'main'];
  }
}

async function getChapterContent(source: PrimeSourceDefinition, chapter: PrimeChapter): Promise<PrimeChapterContent> {
  if (source.adapter === 'project-gutenberg') {
    const text = await requestText(chapter.url);
    const paragraphs = cleanGutenbergText(text);
    if (paragraphs.length === 0) throw new Error('This book did not contain readable text.');
    return { chapter, paragraphs };
  }
  if (source.adapter === 'african-storybook') {
    const bookId = new URL(chapter.url).searchParams.get('id');
    if (!bookId) throw new Error('This story could not be opened.');
    const html = await requestText(`${source.siteUrl}/read/readbook.php`, {
      method: 'POST',
      body: new URLSearchParams({ id: bookId, d: '0', a: '0' }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const paragraphs = nodes(parseDocument(html), '.page-text-story').map((page) => nodeText(page)).filter(Boolean);
    if (paragraphs.length === 0) throw new Error('This story did not contain readable text.');
    return { chapter, paragraphs };
  }
  if (source.adapter === 'wikisource') {
    const pageTitle = wikisourcePageTitle(chapter.url);
    const data = await requestJson<WikisourceParseResponse>(wikisourceApiUrl(source, {
      action: 'parse',
      page: pageTitle,
      prop: 'text',
    }));
    const paragraphs = cleanWikisourceText(data.parse?.text ?? '');
    if (paragraphs.length === 0) throw new Error('This Wikisource page did not contain readable text.');
    return { chapter, paragraphs };
  }
  if (source.adapter === 'library-of-congress') {
    const text = await requestText(chapter.url);
    const paragraphs = cleanLocText(text);
    if (paragraphs.length === 0) throw new Error('This Library of Congress item did not contain readable text.');
    return { chapter, paragraphs };
  }
  if (source.adapter === 'genesis-studio') {
    const match = chapter.url.match(/\/novels\/([^/]+)\/chapter-(\d+)/);
    if (!match) throw new Error('This Genesis Studio chapter URL is invalid.');
    const records = await requestJson<GenesisNovelRecord[]>(genesisApiUrl('/api/directus/novels', { 'filter[slug]': match[1], limit: '1' }));
    const record = records[0];
    if (!record?.id) throw new Error('This Genesis Studio novel could not be found.');
    const chapterResponse = await requestJson<{ data?: { chapters?: GenesisChapterRecord[] } }>(`${source.siteUrl}/api/novels-chapter/${encodeURIComponent(record.id)}`);
    const chapterRecord = genesisChapterList(chapterResponse).find((item) => item.chapter_number === Number(match[2]) && item.id !== undefined);
    if (!chapterRecord?.id) throw new Error('This Genesis Studio chapter could not be found.');
    const contentResponse = await requestJson<{ data?: { chapter_content?: string } }>(`${source.siteUrl}/api/chapters/${encodeURIComponent(String(chapterRecord.id))}/content`);
    const paragraphs = cleanHtmlParagraphs(contentResponse.data?.chapter_content ?? '');
    if (paragraphs.length === 0) throw new Error('This Genesis Studio chapter did not contain readable text.');
    return { chapter, paragraphs };
  }
  const chapterHtml = await requestText(chapter.url, source.adapter === 'wattpad' ? { headers: { Referer: 'https://www.wattpad.com/' } } : undefined);
  if (source.adapter === 'sufficient-velocity') {
    const postId = chapter.url.match(/#(post-\d+)$/)?.[1];
    const paragraphs = postId ? forumPostParagraphs(parseDocument(chapterHtml), `[data-content="${postId}"]`) : [];
    if (paragraphs.length === 0) throw new Error('This chapter did not contain readable text.');
    return { chapter, paragraphs };
  }
  if (source.adapter === 'questionable-questing') {
    const postId = chapter.url.match(/\/post-(\d+)/)?.[1];
    const paragraphs = postId ? forumPostParagraphs(parseDocument(chapterHtml), `#js-post-${postId}`) : [];
    if (paragraphs.length === 0) throw new Error('This Questionable Questing chapter did not contain readable text.');
    return { chapter, paragraphs };
  }
  if (source.adapter === 'wuxia-click') {
    const paragraphs = nodes(parseDocument(chapterHtml), '#chapterText').map((item) => nodeText(item)).filter(Boolean);
    if (paragraphs.length === 0) throw new Error('This WuxiaClick chapter did not contain readable text.');
    return { chapter, paragraphs };
  }
  if (source.adapter === 'wattpad') {
    const pageMatch = chapterHtml.match(/["']?pages["']?\s*[:=]\s*(\d+)/i);
    const pageCount = Math.max(1, Number(pageMatch?.[1] ?? 1));
    const pages: string[] = [];
    for (let page = 1; page <= pageCount; page += 1) {
      const pageUrl = pageCount > 1 ? chapter.url + '/page/' + page : chapter.url;
      const pageHtml = page === 1 ? chapterHtml : await requestText(pageUrl, { headers: { Referer: chapter.url } });
      pages.push(...cleanParagraphs(parseDocument(pageHtml), ['.row.part-content .panel.panel-reading', '.panel.panel-reading', '.story-content']));
    }
    if (pages.length > 0) return { chapter, paragraphs: pages };
  }
  const paragraphs = cleanParagraphs(parseDocument(chapterHtml), contentSelectors(source.adapter));
  if (paragraphs.length === 0) throw new Error('This chapter did not contain readable text.');
  return { chapter, paragraphs };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Search timed out.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function searchSourceWithTimeout(source: PrimeSourceDefinition, query: string) {
  try {
    return { source, novels: await withTimeout(searchSource(source, query, SEARCH_TIMEOUT_MS), SEARCH_TIMEOUT_MS) } satisfies PrimeSourceSearchResult;
  } catch (error) {
    return { source, novels: [], error: sourceError(error) } satisfies PrimeSourceSearchResult;
  }
}

export async function searchPrimeSourcesIncremental(
  sources: PrimeSourceDefinition[],
  query: string,
  onResult: (result: PrimeSourceSearchResult) => void,
) {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 1) return [] as PrimeSourceSearchResult[];

  const results = await Promise.all(sources.map(async (source) => {
    const result = await searchSourceWithTimeout(source, trimmedQuery);
    onResult(result);
    return result;
  }));
  return results;
}

export async function searchPrimeSources(sources: PrimeSourceDefinition[], query: string) {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 1) return [] as PrimeSourceSearchResult[];
  return searchPrimeSourcesIncremental(sources, trimmedQuery, () => undefined);
}

export async function loadPrimeNovel(source: PrimeSourceDefinition, novel: PrimeNovel) {
  return getNovelDetails(source, novel);
}

export async function loadPrimeChapter(source: PrimeSourceDefinition, chapter: PrimeChapter) {
  return getChapterContent(source, chapter);
}

export function flattenSearchResults(results: PrimeSourceSearchResult[]) {
  return results.flatMap((result) => result.novels);
}

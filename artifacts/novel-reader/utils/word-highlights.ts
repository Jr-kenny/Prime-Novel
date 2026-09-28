export type WordHighlight = {
  id: string;
  bookId: string;
  chapter: number;
  paragraphIndex: number;
  wordIndex: number;
  word: string;
  createdAt: number;
};

export type WordToken = {
  text: string;
  index: number;
  isWord: boolean;
};

export function highlightKey(bookId: string, chapter: number, paragraphIndex: number, wordIndex: number) {
  return `${bookId}:${chapter}:${paragraphIndex}:${wordIndex}`;
}

export function tokenizeParagraph(paragraph: string): WordToken[] {
  const tokens: WordToken[] = [];
  const pattern = /(\p{L}[\p{L}\p{M}\p{N}'’-]*|\p{N}+(?:[.,]\p{N}+)*)/gu;
  let lastIndex = 0;
  let wordIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(paragraph)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: paragraph.slice(lastIndex, match.index),
        index: -1,
        isWord: false,
      });
    }
    tokens.push({
      text: match[0],
      index: wordIndex,
      isWord: true,
    });
    wordIndex += 1;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < paragraph.length) {
    tokens.push({
      text: paragraph.slice(lastIndex),
      index: -1,
      isWord: false,
    });
  }

  return tokens;
}

export function toggleHighlight(
  highlights: WordHighlight[],
  next: Omit<WordHighlight, 'id' | 'createdAt'>,
): WordHighlight[] {
  const id = highlightKey(next.bookId, next.chapter, next.paragraphIndex, next.wordIndex);
  const existing = highlights.find((item) => item.id === id);
  if (existing) {
    return highlights.filter((item) => item.id !== id);
  }
  return [
    {
      ...next,
      id,
      createdAt: Date.now(),
    },
    ...highlights,
  ];
}

export function isWordHighlighted(
  highlights: WordHighlight[],
  bookId: string,
  chapter: number,
  paragraphIndex: number,
  wordIndex: number,
): boolean {
  const id = highlightKey(bookId, chapter, paragraphIndex, wordIndex);
  return highlights.some((item) => item.id === id);
}

export function highlightsForChapter(
  highlights: WordHighlight[],
  bookId: string,
  chapter: number,
): WordHighlight[] {
  return highlights.filter((item) => item.bookId === bookId && item.chapter === chapter);
}

export function formatHighlightsForCopy(
  highlights: WordHighlight[],
  paragraphs: string[],
): string {
  const ordered = [...highlights].sort((left, right) => (
    left.paragraphIndex - right.paragraphIndex || left.wordIndex - right.wordIndex
  ));

  const byParagraph = new Map<number, WordHighlight[]>();
  ordered.forEach((item) => {
    const list = byParagraph.get(item.paragraphIndex) ?? [];
    list.push(item);
    byParagraph.set(item.paragraphIndex, list);
  });

  const lines: string[] = [];
  [...byParagraph.entries()]
    .sort((left, right) => left[0] - right[0])
    .forEach(([paragraphIndex, words]) => {
      const paragraph = paragraphs[paragraphIndex] ?? '';
      const tokens = tokenizeParagraph(paragraph);
      const selected = new Set(words.map((word) => word.wordIndex));
      let line = '';
      tokens.forEach((token) => {
        if (!token.isWord) {
          if (selected.size === 0 || line.length > 0) line += token.text;
          return;
        }
        if (selected.has(token.index)) {
          line += token.text;
        }
      });
      const trimmed = line.replace(/\s+/g, ' ').trim();
      if (trimmed) lines.push(trimmed);
    });

  return lines.join('\n');
}

export function formatChapterForCopy(paragraphs: string[]): string {
  return paragraphs.join('\n\n');
}

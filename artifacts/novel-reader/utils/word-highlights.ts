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

import {
  formatChapterForCopy,
  formatHighlightsForCopy,
  highlightKey,
  isWordHighlighted,
  tokenizeParagraph,
  toggleHighlight,
  type WordHighlight,
} from '../utils/word-highlights.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const tokens = tokenizeParagraph("Hello, world's 42!");
assert(tokens.filter((token) => token.isWord).length === 3, 'words are tokenized');
assert(tokens[0].isWord && tokens[0].text === 'Hello', 'first word');
assert(!tokens[1].isWord && tokens[1].text === ', ', 'punctuation kept as non-word');
assert(tokens.some((token) => token.isWord && token.text === "world's"), 'apostrophes stay in words');

const base = { bookId: 'book', chapter: 2, paragraphIndex: 0, wordIndex: 1, word: 'Hello' };
let highlights = toggleHighlight([], base);
assert(highlights.length === 1, 'toggle adds a highlight');
assert(isWordHighlighted(highlights, 'book', 2, 0, 1), 'highlight is visible');
assert(highlightKey('book', 2, 0, 1) === highlights[0].id, 'stable highlight id');

// Unlimited highlights across a full screen of words.
let many: WordHighlight[] = [];
for (let index = 0; index < 80; index += 1) {
  many = toggleHighlight(many, {
    bookId: 'book',
    chapter: 1,
    paragraphIndex: 0,
    wordIndex: index,
    word: `w${index}`,
  });
}
assert(many.length === 80, 'users can highlight as many words as they want');

highlights = toggleHighlight(highlights, base);
assert(highlights.length === 0, 'toggle removes a highlight');
assert(!isWordHighlighted(highlights, 'book', 2, 0, 1), 'highlight is cleared');

const paragraphs = ['Hello bright world', 'Second paragraph here'];
const selected: WordHighlight[] = [
  { id: 'a', bookId: 'book', chapter: 1, paragraphIndex: 0, wordIndex: 0, word: 'Hello', createdAt: 1 },
  { id: 'b', bookId: 'book', chapter: 1, paragraphIndex: 0, wordIndex: 2, word: 'world', createdAt: 2 },
  { id: 'c', bookId: 'book', chapter: 1, paragraphIndex: 1, wordIndex: 1, word: 'paragraph', createdAt: 3 },
];
const copied = formatHighlightsForCopy(selected, paragraphs);
assert(copied.includes('Hello'), 'copy keeps first highlight');
assert(copied.includes('world'), 'copy keeps later highlight');
assert(copied.includes('paragraph'), 'copy keeps other paragraphs');
assert(!copied.includes('bright'), 'copy skips unhighlighted words');

assert(formatChapterForCopy(paragraphs) === 'Hello bright world\n\nSecond paragraph here', 'copy entire chapter/screen');

console.log('test-word-highlights: ok');

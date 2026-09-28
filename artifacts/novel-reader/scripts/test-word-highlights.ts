import {
  highlightKey,
  isWordHighlighted,
  tokenizeParagraph,
  toggleHighlight,
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

highlights = toggleHighlight(highlights, base);
assert(highlights.length === 0, 'toggle removes a highlight');
assert(!isWordHighlighted(highlights, 'book', 2, 0, 1), 'highlight is cleared');

console.log('test-word-highlights: ok');

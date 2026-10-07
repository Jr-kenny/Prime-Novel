import { formatChapterForCopy } from '../utils/word-highlights.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const paragraphs = ['Hello bright world', 'Second paragraph here'];
assert(formatChapterForCopy(paragraphs) === 'Hello bright world\n\nSecond paragraph here', 'copy entire chapter/screen');
assert(formatChapterForCopy([]) === '', 'empty chapter copies to empty string');

console.log('test-word-highlights: ok');

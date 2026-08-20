import assert from 'node:assert/strict';
import { rankTitleSearchResults, titleSearchScore } from '../utils/search-ranking';

const results = [
  { title: 'The Billionaire With Bullets' },
  { title: 'From Bullets to Billion' },
  { title: 'Bullets of a Billionaire' },
  { title: 'Billion Dollar System' },
];

assert.equal(rankTitleSearchResults(results, 'Bullets to Billion')[0].title, 'From Bullets to Billion');
assert.equal(rankTitleSearchResults(results, 'bullets TO billion!!!')[0].title, 'From Bullets to Billion');
assert.ok(titleSearchScore('From Bullets to Billion', 'Bullet to Billion') < titleSearchScore('The Billionaire With Bullets', 'Bullet to Billion'));
assert.ok(titleSearchScore('Bullets to Billion', 'Bullets to Billion') < titleSearchScore('From Bullets to Billion', 'Bullets to Billion'));
assert.ok(titleSearchScore('From Bullets Straight to a Billion', 'Bullets to Billion') < titleSearchScore('The Billionaire With Bullets', 'Bullets to Billion'));

console.log('Prime Novel smart title ranking checks passed.');

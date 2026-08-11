export type PrimeSourceAdapterId =
  | 'royal-road'
  | 'wuxia-world-site'
  | 'creative-novels'
  | 'asian-hobbyist'
  | 'light-novel-heaven'
  | 'sleepy-translations'
  | 'wattpad'
  | 'paw-read'
  | 'read-from-net'
  | 'read-novel-full'
  | 'novel-buddy'
  | 'sufficient-velocity'
  | 'project-gutenberg'
  | 'wikisource'
  | 'library-of-congress'
  | 'african-storybook';

export type PrimeSourceDefinition = {
  id: string;
  name: string;
  siteUrl: string;
  imageUrl: string;
  language: string;
  adapter: PrimeSourceAdapterId;
  coverage?: string[];
  provenance: {
    repositoryUrl: string;
    fileName: string;
    version: string;
    checksum: string;
  };
};

const universeRepositoryUrl = 'https://repo.shosetsu.app/universe/';

/**
 * Prime owns the adapter and catalog record. The provenance fields stay with
 * the record so the source reference and its license obligations are not lost.
 * No Shosetsu Lua implementation is bundled here.
 */
export const PRIME_SOURCE_REGISTRY: PrimeSourceDefinition[] = [
  {
    id: 'royal-road',
    name: 'Royal Road',
    siteUrl: 'https://www.royalroad.com',
    imageUrl: 'https://github.com/shosetsuorg/extensions/raw/dev/icons/RoyalRoad.png',
    language: 'en',
    adapter: 'royal-road',
    coverage: ['fantasy', 'romance', 'sci-fi', 'supernatural', 'horror', 'community-published'],
    provenance: { repositoryUrl: universeRepositoryUrl, fileName: 'RoyalRoad', version: '1.0.17', checksum: '738e5967a500d059308a1489df9efef775fe840cf9397515d90ed8b1c9fbddef' },
  },
  {
    id: 'wuxiaworld-site',
    name: 'WuxiaWorld.Site',
    siteUrl: 'https://wuxiaworld.site',
    imageUrl: 'https://wuxiaworld.site/wp-content/uploads/2019/02/WuxiaWorld-e1567126455773.png',
    language: 'en',
    adapter: 'wuxia-world-site',
    coverage: ['fantasy', 'supernatural', 'action', 'community-published'],
    provenance: { repositoryUrl: universeRepositoryUrl, fileName: 'WuxiaWorldsite', version: '1.0.6', checksum: 'c075cacf8d584dd8bce32d7e13fb37e4f0a7e25c3f2e8b29aa78efc6814df764' },
  },
  {
    id: 'creative-novels',
    name: 'Creative Novels',
    siteUrl: 'https://creativenovels.com',
    imageUrl: 'https://shosetsuorg.gitlab.io/extensions/icons/CreativeNovels.png',
    language: 'en',
    adapter: 'creative-novels',
    coverage: ['fantasy', 'romance', 'action', 'sci-fi', 'community-published'],
    provenance: { repositoryUrl: universeRepositoryUrl, fileName: 'CreativeNovels', version: '2.1.1', checksum: 'e7333dd042c89f745044b354fda9d375dfa7fc17ad06a53af136157de42fc948' },
  },
  {
    id: 'asian-hobbyist',
    name: 'Asian Hobbyist',
    siteUrl: 'https://www.asianhobbyist.com',
    imageUrl: 'https://github.com/shosetsuorg/extensions/raw/dev/icons/AsianHobbyist.png',
    language: 'en',
    adapter: 'asian-hobbyist',
    coverage: ['fantasy', 'romance', 'action', 'community-published'],
    provenance: { repositoryUrl: universeRepositoryUrl, fileName: 'AsianHobbyist', version: '2.0.6', checksum: '67801ba61851096fb886b3d719141c542f00cf7b88e1ef5d645e2981f1754be8' },
  },
  {
    id: 'light-novel-heaven',
    name: 'Light Novel Heaven',
    siteUrl: 'https://lightnovelheaven.com',
    imageUrl: 'https://github.com/shosetsuorg/extensions/raw/dev/icons/LightNovelHeaven.png',
    language: 'en',
    adapter: 'light-novel-heaven',
    coverage: ['fantasy', 'romance', 'supernatural', 'action', 'community-published'],
    provenance: { repositoryUrl: universeRepositoryUrl, fileName: 'LightNovelHeaven', version: '2.1.0', checksum: 'e872b449990910bfe310a3a7345e5fe08b6ebb995ccd296b37228a603ca2a789' },
  },
  {
    id: 'sleepy-translations',
    name: 'Sleepy Translations',
    siteUrl: 'https://sleepytranslations.com',
    imageUrl: 'https://github.com/shosetsuorg/extensions/raw/dev/icons/SleepyTranslations.png',
    language: 'en',
    adapter: 'sleepy-translations',
    coverage: ['fantasy', 'supernatural', 'action', 'community-published'],
    provenance: { repositoryUrl: universeRepositoryUrl, fileName: 'SleepyTranslations', version: '1.0.3', checksum: 'bb069747359411a3c206b6c8012c1d6f82e281d26d47ef79c7b0cfa155c2481c' },
  },
  {
    id: 'wattpad',
    name: 'Wattpad',
    siteUrl: 'https://www.wattpad.com',
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/2111/2111715.png',
    language: 'en',
    adapter: 'wattpad',
    coverage: ['general fiction', 'romance', 'fantasy', 'crime', 'mystery', 'thrillers', 'horror', 'historical fiction', 'community-published'],
    provenance: { repositoryUrl: universeRepositoryUrl, fileName: 'Wattpad', version: '1.0.7', checksum: '62a82f610bbb175bd43bdda878b6bccb556a78d82211a9fc84a64c36f76de42c' },
  },
  {
    id: 'novel-buddy',
    name: 'NovelBuddy',
    siteUrl: 'https://novelbuddy.me',
    imageUrl: 'https://novelbuddy.me/static/sites/novelbuddy-me/icons/android-chrome-192x192.png',
    language: 'en',
    adapter: 'novel-buddy',
    coverage: ['fantasy', 'romance', 'supernatural', 'sci-fi', 'action', 'community-published'],
    provenance: { repositoryUrl: universeRepositoryUrl, fileName: 'Novelbuddy', version: '2.0.1', checksum: 'ce88a1e33b0017a3c15e0836c7d2ae0d450ed0b2e21bdf34cee2e981064b345a' },
  },
  {
    id: 'sufficient-velocity',
    name: 'Sufficient Velocity',
    siteUrl: 'https://forums.sufficientvelocity.com',
    imageUrl: 'https://gitlab.com/shosetsuorg/extensions/-/raw/dev/icons/SufficientVelocity.png',
    language: 'en',
    adapter: 'sufficient-velocity',
    coverage: ['fantasy', 'sci-fi', 'supernatural', 'community-published'],
    provenance: { repositoryUrl: universeRepositoryUrl, fileName: 'SufficientVelocity', version: '1.1.2', checksum: '4723b977049e25f002362add93e01e9ac13809a897b6a502ac006fe606f28436' },
  },
  {
    id: 'paw-read',
    name: 'PawRead',
    siteUrl: 'https://m.pawread.com',
    imageUrl: 'https://res.pawread.com/images/logo/dmzj-phone.png',
    language: 'en',
    adapter: 'paw-read',
    coverage: ['fantasy', 'romance', 'action', 'historical fiction', 'community-published'],
    provenance: { repositoryUrl: universeRepositoryUrl, fileName: 'Pawread', version: '1.0.1', checksum: 'b4cc9379566fe90c78f8ff3f7ea1aec1f56e08f3e6ec448942479967267234f5' },
  },
  {
    id: 'read-from-net',
    name: 'Read From Net',
    siteUrl: 'https://readfrom.net',
    imageUrl: 'https://shosetsuorg.gitlab.io/extensions/icons/ReadFromNet.png',
    language: 'en',
    adapter: 'read-from-net',
    coverage: ['general fiction', 'romance', 'crime', 'mystery', 'thrillers', 'horror', 'historical fiction', 'biography', 'memoir'],
    provenance: { repositoryUrl: universeRepositoryUrl, fileName: 'ReadFromNet', version: '1.1.1', checksum: 'db9fa6fb6e1bbe9b048ba00d23554387c421ab07a095397841c7530a179e852d' },
  },
  {
    id: 'read-novel-full',
    name: 'Read Novel Full',
    siteUrl: 'https://readnovelfull.com',
    imageUrl: 'https://shosetsuorg.gitlab.io/extensions/icons/ReadNovelFull.png',
    language: 'en',
    adapter: 'read-novel-full',
    coverage: ['general fiction', 'romance', 'fantasy', 'crime', 'mystery', 'thrillers', 'horror', 'community-published'],
    provenance: { repositoryUrl: universeRepositoryUrl, fileName: 'ReadNovelFull', version: '1.0.0', checksum: 'e9e57e442e1d7091d0c232d8060038604c5f4ab5781027ff8b77d1ddf63ee393' },
  },
  {
    id: 'project-gutenberg',
    name: 'Project Gutenberg',
    siteUrl: 'https://www.gutenberg.org',
    imageUrl: 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
    language: 'multi',
    adapter: 'project-gutenberg',
    coverage: ['general fiction', 'romance', 'fantasy', 'finance', 'crime', 'mystery', 'thrillers', 'horror', 'historical fiction', 'inspirational', 'self-improvement', 'christian', 'religious literature', 'biography', 'memoir', 'young adults', 'children', 'public domain'],
    provenance: { repositoryUrl: 'https://www.gutenberg.org/ebooks/offline_catalogs.html', fileName: 'Gutendex catalog and Gutenberg text', version: 'live', checksum: 'catalogue-adapter-owned' },
  },
  {
    id: 'wikisource',
    name: 'Wikisource',
    siteUrl: 'https://en.wikisource.org',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Wikisource-logo.svg',
    language: 'multi',
    adapter: 'wikisource',
    coverage: ['classics', 'general fiction', 'poetry', 'history', 'religion', 'children', 'short stories', 'multilingual'],
    provenance: { repositoryUrl: 'https://www.mediawiki.org/wiki/API:Action_API', fileName: 'MediaWiki Action API', version: 'live', checksum: 'catalogue-adapter-owned' },
  },
  {
    id: 'library-of-congress',
    name: 'Library of Congress',
    siteUrl: 'https://www.loc.gov',
    imageUrl: 'https://www.loc.gov/static/images/logo-loc-new-branding.svg',
    language: 'multi',
    adapter: 'library-of-congress',
    coverage: ['American literature', 'history', 'biography', 'children', 'government publications', 'multilingual collections'],
    provenance: { repositoryUrl: 'https://www.loc.gov/apis/json-and-yaml/', fileName: 'loc.gov JSON API and Text Services', version: 'live', checksum: 'catalogue-adapter-owned' },
  },
  {
    id: 'african-storybook',
    name: 'African Storybook',
    siteUrl: 'https://www.africanstorybook.org',
    imageUrl: 'https://www.africanstorybook.org/images/asblogo.png',
    language: 'multi',
    adapter: 'african-storybook',
    coverage: ['african literature', 'children', 'community-published', 'open license', 'inspirational'],
    provenance: { repositoryUrl: 'https://www.africanstorybook.org/terms.html', fileName: 'read/readbook.php', version: 'live', checksum: 'catalogue-adapter-owned' },
  },
];

export function getPrimeSource(sourceId: string) {
  return PRIME_SOURCE_REGISTRY.find((source) => source.id === sourceId);
}

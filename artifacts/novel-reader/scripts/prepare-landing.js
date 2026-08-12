const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distRoot = path.join(projectRoot, 'dist');
const landingTemplate = path.join(projectRoot, 'server', 'templates', 'landing-page.html');
const exportedIndex = path.join(distRoot, 'index.html');
const appIndex = path.join(distRoot, 'app', 'index.html');
const landingAssets = path.join(distRoot, 'landing-assets');

const assets = [
  'icon.png',
  'cover-lighthouse.jpg',
  'cover-observatory.jpg',
  'cover-greenhouse.jpg',
];

if (!fs.existsSync(exportedIndex)) {
  throw new Error('Expo web export is missing dist/index.html. Run expo export before preparing the landing page.');
}

fs.mkdirSync(path.dirname(appIndex), { recursive: true });
const exportedHtml = fs.readFileSync(exportedIndex, 'utf8');
const appSource = exportedHtml.includes('PRIME_NOVEL_LANDING_PAGE') && fs.existsSync(appIndex)
  ? appIndex
  : exportedIndex;
fs.copyFileSync(appSource, appIndex);
fs.rmSync(landingAssets, { recursive: true, force: true });
fs.mkdirSync(landingAssets, { recursive: true });

for (const asset of assets) {
  fs.copyFileSync(
    path.join(projectRoot, 'assets', 'images', asset),
    path.join(landingAssets, asset),
  );
}

fs.copyFileSync(landingTemplate, path.join(distRoot, 'index.html'));
console.log(`Prepared Prime Novel landing page and ${assets.length} landing assets.`);

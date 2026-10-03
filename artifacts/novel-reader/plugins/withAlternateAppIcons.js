const { withAndroidManifest, withInfoPlist, withDangerousMod, AndroidConfig, createRunOncePlugin } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const icons = [
  { id: 'classic', file: 'app-icon-classic.png', androidAlias: null },
  { id: 'black', file: 'app-icon-black.png', androidAlias: 'MainActivityBlackIcon' },
  { id: 'white', file: 'app-icon-white.png', androidAlias: 'MainActivityWhiteIcon' },
  { id: 'orange', file: 'app-icon-orange.png', androidAlias: 'MainActivityOrangeIcon' },
  { id: 'cream', file: 'app-icon-cream.png', androidAlias: 'MainActivityCreamIcon' },
  { id: 'midnight', file: 'app-icon-midnight.png', androidAlias: 'MainActivityMidnightIcon' },
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function withAndroidIcons(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const resRoot = path.join(modConfig.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');

      for (const icon of icons) {
        const mipmapFolders = {
          mdpi: 48,
          hdpi: 72,
          xhdpi: 96,
          xxhdpi: 144,
          xxxhdpi: 192,
        };

        for (const [folder, size] of Object.entries(mipmapFolders)) {
          const name = icon.id === 'classic' ? 'ic_launcher' : `ic_launcher_${icon.id}`;
          const destination = path.join(resRoot, `mipmap-${folder}`, `${name}.png`);
          const source = path.join(projectRoot, 'assets/icons', icon.file);
          ensureDir(destination);
          if (fs.existsSync(source)) {
            fs.copyFileSync(source, destination);
          } else {
            // Fallback: reuse the primary launcher asset when a variant is missing.
            const fallback = path.join(projectRoot, 'assets/images/icon-launcher.png');
            if (fs.existsSync(fallback)) fs.copyFileSync(fallback, destination);
          }
        }
      }

      return modConfig;
    },
  ]);
}

function withAndroidManifestAliases(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults;
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    application.activity = application.activity ?? [];
    const mainActivity = application.activity.find(
      (activity) => activity.$?.['android:name'] === '.MainActivity' || activity.$?.['android:name'] === 'MainActivity',
    );

    if (!mainActivity) {
      throw new Error('Prime Novel MainActivity was not found in AndroidManifest.xml');
    }

    const mainName = mainActivity.$['android:name'];
    const packageName = manifest.$?.package ?? '';
    const targetActivity = mainName.startsWith('.') ? `${packageName}${mainName}` : mainName;

    application['activity-alias'] = application['activity-alias'] ?? [];

    // Remove previously generated aliases so re-prebuild stays idempotent.
    const generatedAliases = new Set(icons.filter((icon) => icon.androidAlias).map((icon) => `.${icon.androidAlias}`));
    application['activity-alias'] = application['activity-alias'].filter((alias) => {
      const name = alias.$?.['android:name'] ?? '';
      return !generatedAliases.has(name);
    });

    for (const icon of icons) {
      if (!icon.androidAlias) continue;
      application['activity-alias'].push({
        $: {
          'android:name': `.${icon.androidAlias}`,
          'android:enabled': 'false',
          'android:exported': 'true',
          'android:icon': `@mipmap/ic_launcher_${icon.id}`,
          'android:targetActivity': targetActivity,
          'android:label': 'Prime Novel',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
            category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
          },
        ],
      });
    }

    return modConfig;
  });
}

function withIosIcons(config) {
  return withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const iosRoot = modConfig.modRequest.platformProjectRoot;
      const imagesPath = path.join(iosRoot, 'Images.xcassets');

      for (const icon of icons) {
        const destination = path.join(imagesPath, `${icon.file}`);
        const source = path.join(projectRoot, 'assets/icons', icon.file);
        ensureDir(destination);
        if (fs.existsSync(source)) {
          fs.copyFileSync(source, destination);
        }
      }

      return modConfig;
    },
  ]);
}

function withIosAlternateIcons(config) {
  return withInfoPlist(config, (modConfig) => {
    const infoPlist = modConfig.modResults;
    infoPlist.CFBundleAlternateIcons = {
      black: { CFBundleIconFiles: ['app-icon-black'] },
      white: { CFBundleIconFiles: ['app-icon-white'] },
      orange: { CFBundleIconFiles: ['app-icon-orange'] },
      cream: { CFBundleIconFiles: ['app-icon-cream'] },
      midnight: { CFBundleIconFiles: ['app-icon-midnight'] },
    };
    infoPlist.UIPrerenderedIcon = true;
    return modConfig;
  });
}

const withAlternateAppIcons = (config) => {
  config = withAndroidIcons(config);
  config = withAndroidManifestAliases(config);
  config = withIosIcons(config);
  config = withIosAlternateIcons(config);
  return config;
};

module.exports = createRunOncePlugin(withAlternateAppIcons, 'prime-alternate-app-icons', '1.0.0');

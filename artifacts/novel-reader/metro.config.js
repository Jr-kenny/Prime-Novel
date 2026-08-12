const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Watchman is unavailable in the shared macOS workspace, so use Metro's Node crawler.
config.resolver.useWatchman = false;

module.exports = config;

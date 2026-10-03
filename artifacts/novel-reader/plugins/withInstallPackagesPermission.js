const { withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

const withInstallPackagesPermission = (config) => {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults;
    manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] ?? [];
    const permissions = manifest.manifest['uses-permission'];
    const exists = permissions.some((entry) => entry.$?.['android:name'] === 'android.permission.REQUEST_INSTALL_PACKAGES');
    if (!exists) {
      permissions.push({ $: { 'android:name': 'android.permission.REQUEST_INSTALL_PACKAGES' } });
    }
    return modConfig;
  });
};

module.exports = createRunOncePlugin(withInstallPackagesPermission, 'prime-install-packages-permission', '1.0.0');

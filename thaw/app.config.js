const appJson = require('./app.json');
const { withAppBuildGradle } = require('@expo/config-plugins');

const SIGNING_MARKER = 'thawKeystorePropertiesFile';

function withThawReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') return mod;
    let src = mod.modResults.contents;
    if (src.includes(SIGNING_MARKER)) return mod;

    const loader = `def thawKeystoreProperties = new Properties()
def thawKeystorePropertiesFile = rootProject.file("../keystore.properties")
if (thawKeystorePropertiesFile.exists()) {
    thawKeystoreProperties.load(new FileInputStream(thawKeystorePropertiesFile))
}

`;
    src = loader + src;
    src = src.replace(
      /keyPassword 'android'\n        \}/,
      `keyPassword 'android'
        }
        release {
            if (thawKeystorePropertiesFile.exists()) {
                storeFile file(thawKeystoreProperties['storeFile'])
                storePassword thawKeystoreProperties['storePassword']
                keyAlias thawKeystoreProperties['keyAlias']
                keyPassword thawKeystoreProperties['keyPassword']
            }
        }`,
    );
    src = src.replace(
      /release \{\n            \/\/ Caution![\s\S]*?signingConfig signingConfigs\.debug/,
      (block) =>
        block.replace(
          'signingConfig signingConfigs.debug',
          'signingConfig thawKeystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug',
        ),
    );
    mod.modResults.contents = src;
    return mod;
  });
}

module.exports = () => {
  const config = appJson.expo;
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY?.trim();
  if (mapsKey && !/^YOUR_.*_HERE$/.test(mapsKey)) {
    config.android = {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey: mapsKey },
      },
    };
  }
  return withThawReleaseSigning(config);
};

const { getDefaultConfig } = require('@react-native/metro-config');

module.exports = (async () => {
  const defaultConfig = await getDefaultConfig(__dirname);

  return {
    ...defaultConfig,
    transformer: {
      ...defaultConfig.transformer,
      minifierConfig: {
        keep_classnames: false,
        keep_fnames: false,
        mangle: true,
        sourceMap: false,
      },
    },
  };
})();

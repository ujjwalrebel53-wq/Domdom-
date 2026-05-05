const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable Hermes for 120fps performance on Android
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
    mangle: { keep_classnames: true, keep_fnames: true },
    output: { ascii_only: true, quote_style: 3, wrap_iife: true },
    parse: { bare_returns: false },
    toplevel: false,
  },
};

module.exports = config;

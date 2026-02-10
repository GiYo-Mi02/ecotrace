// AUDIT FIX: Removed NativeWind wrapper
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

module.exports = config;

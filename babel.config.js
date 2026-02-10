// AUDIT FIX: Removed NativeWind/Tailwind presets
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
  };
};

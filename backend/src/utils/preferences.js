const DEFAULT_THEME = Object.freeze({
  baseColor: "#7aab9a",
  saturation: 100,
  intensity: 100,
});

function getDefaultPreferences() {
  return {
    theme: { ...DEFAULT_THEME },
  };
}

function normalizeThemePreferences(theme = {}) {
  return {
    baseColor: typeof theme.baseColor === "string" ? theme.baseColor : DEFAULT_THEME.baseColor,
    saturation: Number.isFinite(theme.saturation) ? theme.saturation : DEFAULT_THEME.saturation,
    intensity: Number.isFinite(theme.intensity) ? theme.intensity : DEFAULT_THEME.intensity,
  };
}

function normalizePreferences(preferences = {}) {
  return {
    theme: normalizeThemePreferences(preferences.theme),
  };
}

module.exports = {
  getDefaultPreferences,
  normalizePreferences,
};

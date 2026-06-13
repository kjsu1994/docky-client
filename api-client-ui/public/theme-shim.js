(function () {
  var storageKey = "docky.theme";
  var root = document.documentElement;
  var themeColors = {
    light: "#f8fafc",
    dark: "#020617"
  };

  function normalize(value) {
    return value === "light" || value === "dark" ? value : "system";
  }

  function resolve(normalized) {
    if (normalized === "light" || normalized === "dark") return normalized;
    if (!window.matchMedia) return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function syncThemeColor(normalized) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", themeColors[resolve(normalized)] || themeColors.light);
  }

  function apply(preference) {
    var normalized = normalize(preference);
    root.dataset.themePreference = normalized;
    if (normalized === "light" || normalized === "dark") {
      root.dataset.theme = normalized;
      syncThemeColor(normalized);
      return;
    }
    delete root.dataset.theme;
    syncThemeColor(normalized);
  }

  try {
    apply(window.localStorage && window.localStorage.getItem(storageKey));
  } catch (error) {
    apply("system");
  }
}());

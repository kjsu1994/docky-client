(function () {
  var storageKey = "docky.theme";
  var root = document.documentElement;

  function normalize(value) {
    return value === "light" || value === "dark" ? value : "system";
  }

  function apply(preference) {
    var normalized = normalize(preference);
    root.dataset.themePreference = normalized;
    if (normalized === "light" || normalized === "dark") {
      root.dataset.theme = normalized;
      return;
    }
    delete root.dataset.theme;
  }

  try {
    apply(window.localStorage && window.localStorage.getItem(storageKey));
  } catch (error) {
    apply("system");
  }
}());

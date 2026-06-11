(function () {
  const storageKey = "blog-theme";
  const root = document.documentElement;
  const toggle = document.getElementById("theme-toggle");

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (toggle) {
      toggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
    }
  }

  const saved = localStorage.getItem(storageKey);
  applyTheme(saved || systemTheme());

  if (toggle) {
    toggle.addEventListener("click", function () {
      const current = root.getAttribute("data-theme") || systemTheme();
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem(storageKey, next);
      applyTheme(next);
    });
  }

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener(
    "change",
    function (event) {
      if (!localStorage.getItem(storageKey)) {
        applyTheme(event.matches ? "dark" : "light");
      }
    }
  );
})();

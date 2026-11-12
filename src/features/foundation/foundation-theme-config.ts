export const foundationThemeStorageKey = "ms-chau-ielts-foundation-theme";
export const foundationSystemThemeQuery = "(prefers-color-scheme: dark)";

// Loaded once by next/script in the root layout, before hydration. The marker
// only affects foundation-themed roots while their client state initializes.
export const foundationThemeInitScript = `(() => {
  let saved;
  try { saved = localStorage.getItem(${JSON.stringify(foundationThemeStorageKey)}); } catch {}
  document.documentElement.dataset.foundationTheme = saved === "light" || saved === "dark"
    ? saved
    : (matchMedia(${JSON.stringify(foundationSystemThemeQuery)}).matches ? "dark" : "light");
})();`;

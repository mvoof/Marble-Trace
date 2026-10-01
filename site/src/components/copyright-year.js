/**
 * The footer's copyright year, set from the visitor's clock so it never goes
 * stale. The year baked into the HTML stays as the fallback without scripts.
 */
(() => {
  const setYear = () => {
    document.querySelectorAll('[data-current-year]').forEach((node) => {
      node.textContent = String(new Date().getFullYear());
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setYear);
  } else {
    setYear();
  }
})();

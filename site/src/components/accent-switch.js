/**
 * TEMPORARY - a dev-only switch between the blue and the red accent, to
 * compare them on the real page. Never shipped: the build drops it, and it
 * goes with the losing palette once the choice is made.
 */

const STORAGE_KEY = 'mt-accent';

const readStoredAccent = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const storeAccent = (accent) => {
  try {
    localStorage.setItem(STORAGE_KEY, accent);
  } catch {
    /* private mode: the switch still works for this visit */
  }
};

const applyAccent = (accent) => {
  if (accent === 'red') {
    document.documentElement.dataset.accent = 'red';
  } else {
    delete document.documentElement.dataset.accent;
  }
};

if (import.meta.env.DEV) {
  let accent = readStoredAccent() === 'red' ? 'red' : 'blue';
  applyAccent(accent);

  const button = document.createElement('button');
  button.type = 'button';
  button.style.cssText =
    'position:fixed;right:16px;bottom:16px;z-index:9999;padding:10px 14px;border:0;border-radius:6px;font:700 12px/1 monospace;letter-spacing:.06em;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer';

  const render = () => {
    button.textContent = `ACCENT: ${accent.toUpperCase()} ⇄`;
    button.style.background = accent === 'red' ? '#e10600' : '#4f8fe3';
  };

  button.addEventListener('click', () => {
    accent = accent === 'red' ? 'blue' : 'red';
    applyAccent(accent);
    storeAccent(accent);
    render();
  });

  render();
  document.body.appendChild(button);
}

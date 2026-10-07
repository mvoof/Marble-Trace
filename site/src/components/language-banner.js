/**
 * Offers a returning or foreign-language visitor their own language on the
 * English page, instead of sending them there. The root stays English for
 * everyone - search engines included - and a visitor who closes the offer is
 * not asked again for that language.
 *
 * The language comes from the last one opened (mt-language, written by the
 * script in <head>), or, on a first visit, from the browser's preferences.
 * The banner's own text is in that language: it is written for someone who
 * may not read the English around it.
 */
(() => {
  const STORAGE_KEY = 'mt-language';
  const DISMISS_KEY = 'mt-dismiss-lang';

  const OFFERS = {
    ru: {
      lang: 'ru',
      text: 'Marble Trace доступен на русском языке.',
      action: 'Перейти на русский',
      close: 'Закрыть',
    },
    es: {
      lang: 'es',
      text: 'Marble Trace está disponible en español.',
      action: 'Ver en español',
      close: 'Cerrar',
    },
    zh: {
      lang: 'zh-CN',
      text: 'Marble Trace 提供中文版本。',
      action: '切换到中文',
      close: '关闭',
    },
  };

  const read = (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const write = (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  };

  const fromBrowser = () => {
    const preferred = navigator.languages || [navigator.language || ''];

    for (const tag of preferred) {
      const primary = String(tag).toLowerCase().split('-')[0];

      if (primary === 'en') {
        return null;
      }

      if (OFFERS[primary]) {
        return primary;
      }
    }

    return null;
  };

  const preferredLanguage = () => {
    const stored = read(STORAGE_KEY);

    if (stored) {
      return OFFERS[stored] ? stored : null;
    }

    return fromBrowser();
  };

  const build = (code) => {
    const offer = OFFERS[code];
    const banner = document.createElement('div');

    banner.className = 'language-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', offer.text);
    banner.setAttribute('lang', offer.lang);
    banner.setAttribute('translate', 'no');

    const text = document.createElement('p');

    text.className = 'language-banner-text';
    text.textContent = offer.text;

    const action = document.createElement('a');

    action.className = 'language-banner-action';
    action.href = `${code}/`;
    action.hreflang = offer.lang;
    action.setAttribute('data-lang', code);
    action.textContent = offer.action;

    const close = document.createElement('button');

    close.type = 'button';
    close.className = 'language-banner-close';
    close.setAttribute('aria-label', offer.close);
    close.textContent = '✕';
    close.addEventListener('click', () => {
      write(DISMISS_KEY, code);
      banner.remove();
    });

    banner.append(text, action, close);

    return banner;
  };

  const init = () => {
    // Only the English page offers; a translated copy is already the offer.
    if (document.documentElement.lang !== 'en') {
      return;
    }

    const code = preferredLanguage();

    if (!code || read(DISMISS_KEY) === code) {
      return;
    }

    document.body.append(build(code));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

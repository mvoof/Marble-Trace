/**
 * Marble Trace Site - Latest release
 *
 * Asks GitHub for the latest release once per visit and puts it on the page:
 * every [data-download] link goes straight to the -setup.exe instead of the
 * releases page, and the download band states the version, the size and how
 * long ago it came out. That last line is the "active development" signal - a
 * date nobody has to remember to update.
 *
 * Wording stays in the markup (data-template, translated with the page); only
 * numbers and dates are formatted here, in the page's own language. Without
 * JavaScript, or when the API refuses, every link still reaches the releases
 * page and the meta line stays hidden.
 */

(() => {
  'use strict';

  const API_URL =
    'https://api.github.com/repos/mvoof/Marble-Trace/releases/latest';
  const CACHE_KEY = 'mt-latest-release';
  const INSTALLER_PATTERN = /-setup\.exe$/i;

  const BYTES_PER_MB = 1024 * 1024;
  const SECONDS_PER_DAY = 86400;
  const DAYS_PER_WEEK = 7;
  const DAYS_PER_MONTH = 30;

  const pageLanguage = () => document.documentElement.lang || 'en';

  const readCache = () => {
    try {
      const raw = window.sessionStorage.getItem(CACHE_KEY);

      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const writeCache = (release) => {
    try {
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(release));
    } catch {
      // Storage refused (private window, blocked site data): fetch next time.
    }
  };

  const fetchRelease = async () => {
    const cached = readCache();

    if (cached) {
      return cached;
    }

    const response = await fetch(API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}`);
    }

    const data = await response.json();
    const installer = (data.assets || []).find((asset) =>
      INSTALLER_PATTERN.test(asset.name)
    );

    const release = {
      version: String(data.tag_name || '').replace(/^v/, ''),
      publishedAt: data.published_at,
      notesUrl: data.html_url,
      installerUrl: installer ? installer.browser_download_url : null,
      installerSize: installer ? installer.size : null,
    };

    writeCache(release);

    return release;
  };

  const fill = (element, values) => {
    const template = element.getAttribute('data-template') || '{value}';

    element.textContent = Object.keys(values).reduce(
      (text, key) => text.replace(`{${key}}`, values[key]),
      template
    );
  };

  const relativeDate = (isoDate) => {
    const days = Math.round(
      (Date.parse(isoDate) - Date.now()) / 1000 / SECONDS_PER_DAY
    );
    const format = new Intl.RelativeTimeFormat(pageLanguage(), {
      numeric: 'auto',
    });

    if (Math.abs(days) < DAYS_PER_WEEK) {
      return format.format(days, 'day');
    }

    if (Math.abs(days) < DAYS_PER_MONTH) {
      return format.format(Math.round(days / DAYS_PER_WEEK), 'week');
    }

    return format.format(Math.round(days / DAYS_PER_MONTH), 'month');
  };

  const megabytes = (bytes) =>
    new Intl.NumberFormat(pageLanguage(), {
      style: 'unit',
      unit: 'megabyte',
      maximumFractionDigits: 0,
    }).format(bytes / BYTES_PER_MB);

  const apply = (release) => {
    if (release.installerUrl) {
      document.querySelectorAll('[data-download]').forEach((link) => {
        link.href = release.installerUrl;
        link.removeAttribute('target');
      });
    }

    document.querySelectorAll('[data-release-notes]').forEach((link) => {
      if (release.notesUrl) {
        link.href = release.notesUrl;
      }
    });

    const meta = document.querySelector('[data-release-meta]');

    if (!meta || !release.version) {
      return;
    }

    const version = meta.querySelector('[data-release-version]');
    const size = meta.querySelector('[data-release-size]');
    const date = meta.querySelector('[data-release-date]');

    if (version) {
      fill(version, { version: release.version });
    }

    if (size && release.installerSize) {
      size.textContent = megabytes(release.installerSize);
    }

    if (date && release.publishedAt) {
      fill(date, { date: relativeDate(release.publishedAt) });
    }

    meta.hidden = false;
  };

  const init = () => {
    fetchRelease()
      .then(apply)
      .catch(() => {
        // Offline or rate-limited: the static links already work.
      });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

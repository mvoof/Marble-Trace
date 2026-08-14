// Marble Trace landing — header wave animation, i18n, gallery, lightbox,
// scroll-reveal.
import './styles.css';
import { I18N } from './i18n.js';

/* ---------- Telemetry wave animation (ported from the app header) ---------- */

const DRIFT_SECONDS_PER_CYCLE = 14;

const WAVES = [
  {
    color: 'rgba(16, 185, 129, 0.7)',
    amplitude: 0.2,
    frequency: 0.01,
    phaseOffset: 0,
    speed: 1,
    yFactor: 0.5,
  },
  {
    color: 'rgba(68, 199, 239, 0.5)',
    amplitude: 0.15,
    frequency: 0.015,
    phaseOffset: Math.PI,
    speed: -0.7,
    yFactor: 0.62,
  },
  {
    color: 'rgba(239, 68, 68, 0.5)',
    amplitude: 0.12,
    frequency: 0.02,
    phaseOffset: Math.PI / 2,
    speed: 0.5,
    yFactor: 0.34,
  },
];

const reducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

const startTrace = (canvas) => {
  const context = canvas.getContext('2d');

  if (!context) {
    return;
  }

  let width = 0;
  let height = 0;

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const nextCanvasWidth = Math.round(width * dpr);
    const nextCanvasHeight = Math.round(height * dpr);

    if (
      canvas.width === nextCanvasWidth &&
      canvas.height === nextCanvasHeight
    ) {
      return;
    }

    canvas.width = nextCanvasWidth;
    canvas.height = nextCanvasHeight;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const drawWave = (wave, phase) => {
    const midY = height * wave.yFactor;
    const amplitudePx = height * wave.amplitude;

    context.beginPath();

    for (let x = 0; x <= width; x += 4) {
      const primary =
        Math.sin(x * wave.frequency + phase * wave.speed + wave.phaseOffset) *
        0.6;
      const secondary =
        Math.sin(x * wave.frequency * 2.3 + phase * wave.speed * 1.7) * 0.4;
      const y = midY + (primary + secondary) * amplitudePx;

      if (x === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.strokeStyle = wave.color;
    context.lineWidth = 2;
    context.shadowColor = wave.color;
    context.shadowBlur = 14;
    context.stroke();
    context.shadowBlur = 0;
  };

  const render = (timestamp) => {
    context.clearRect(0, 0, width, height);
    const phase = (timestamp / 1000 / DRIFT_SECONDS_PER_CYCLE) * Math.PI * 2;

    for (const wave of WAVES) {
      drawWave(wave, phase);
    }

    if (!reducedMotion) {
      requestAnimationFrame(render);
    }
  };

  new ResizeObserver(resize).observe(canvas);
  resize();
  requestAnimationFrame(render);
};

const headerCanvas = document.getElementById('headerTrace');

if (headerCanvas) {
  startTrace(headerCanvas);
}

/* ---------- i18n ---------- */

const SUPPORTED_LANGUAGES = Object.keys(I18N);

const readSavedLanguage = () => {
  try {
    return localStorage.getItem('mt-lang');
  } catch {
    return null;
  }
};

const savedLanguage = readSavedLanguage();
const urlLanguage = new URLSearchParams(location.search).get('lang');
const browserLanguage = (navigator.language || 'en').slice(0, 2);

const initialLanguage =
  [urlLanguage, savedLanguage, browserLanguage].find((candidate) =>
    SUPPORTED_LANGUAGES.includes(candidate)
  ) || 'en';

let currentLanguage = 'en';

// Translations of the same block differ in line count, so every section below
// the viewport shifts and the page appears to jump. Pin the section that is
// currently at the top of the screen and scroll back to it afterwards.
const findScrollAnchor = () => {
  let anchor = null;

  for (const section of document.querySelectorAll('main > section')) {
    const top = section.getBoundingClientRect().top;

    if (top <= 1 || anchor === null) {
      anchor = { section, top };
    }
  }

  return anchor;
};

const restoreScrollAnchor = (anchor) => {
  if (!anchor) {
    return;
  }

  const shift = anchor.section.getBoundingClientRect().top - anchor.top;

  if (Math.abs(shift) < 1) {
    return;
  }

  window.scrollTo({ top: window.scrollY + shift, behavior: 'instant' });
};

const applyLanguage = (language) => {
  const anchor = findScrollAnchor();
  currentLanguage = language;
  const dictionary = I18N[language];
  document.documentElement.lang = language;

  try {
    localStorage.setItem('mt-lang', language);
  } catch {
    // Storage may be unavailable (privacy settings, private browsing) — language still applies for this session.
  }

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;

    if (dictionary[key]) {
      element.textContent = dictionary[key];
    }
  });

  document.querySelectorAll('.langSwitch button').forEach((button) => {
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.lang === language)
    );
  });

  renderGallery();
  restoreScrollAnchor(anchor);
};

document.querySelectorAll('.langSwitch button').forEach((button) => {
  button.addEventListener('click', () => applyLanguage(button.dataset.lang));
});

/* ---------- Gallery ---------- */

// files (first one is the gallery thumbnail) → i18n widget key
const GALLERY_ITEMS = [
  [['standings.png'], 'standings'],
  [['map.png', 'map-record.png'], 'trackmap'],
  [['relative.png'], 'relative'],
  [['race-dash.png', 'race-sash-pit.png'], 'racedash'],
  [['rpm-lights.png'], 'rpmlights'],
  [['engine.png'], 'engine'],
  [['fuel.png', 'fuel-pit-stop.png'], 'fuel'],
  [['proximity-radar.png'], 'radar'],
  [['input-trace.png'], 'inputs'],
  [['sector-matrix.png'], 'sectors'],
  [['weather.png'], 'weather'],
  [['pit-stop.png'], 'pitservice'],
  [['coach.png'], 'coach'],
  [['stream-chat.png'], 'streamchat'],
  [['flat-flag.png'], 'flatflags'],
  [['lap-log.png'], 'laplog'],
  [['g-metr.png'], 'gmeter'],
  [['led-flag-dual.png', 'led-flag-one.png'], 'flags'],
  [['timer.png'], 'timer'],
  [['radar-bar.png'], 'radarbar'],
  [['delta.png', 'delta-best.png'], 'delta'],
  [['relative-map.png'], 'linearmap'],
];

const galleryGrid = document.getElementById('galleryGrid');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxNav = document.getElementById('lightboxNav');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const lightboxCounter = document.getElementById('lightboxCounter');

let openedFiles = [];
let openedTitle = '';
let openedDescription = '';
let openedIndex = 0;

const showOpenedImage = () => {
  const file = openedFiles[openedIndex];
  lightboxImg.src = `assets/widgets/${file}`;
  lightboxImg.alt = openedTitle;
  lightboxCaption.textContent = `${openedTitle} — ${openedDescription}`;
  lightboxCounter.textContent = `${openedIndex + 1} / ${openedFiles.length}`;
  lightboxNav.hidden = openedFiles.length < 2;
};

const stepOpenedImage = (step) => {
  openedIndex = (openedIndex + step + openedFiles.length) % openedFiles.length;
  showOpenedImage();
};

const openLightbox = (files, title, description) => {
  openedFiles = files;
  openedTitle = title;
  openedDescription = description;
  openedIndex = 0;
  showOpenedImage();
  lightbox.showModal();
};

// Cards are built once. Switching language only rewrites their text — a full
// rebuild reloads every screenshot and the page jumps while the grid recollapses.
const galleryCards = [];

const buildGallery = () => {
  for (const [files, key] of GALLERY_ITEMS) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'galleryItem';
    const image = document.createElement('img');
    image.src = `assets/widgets/${files[0]}`;
    image.loading = 'lazy';
    const label = document.createElement('span');
    label.className = 'galleryLabel';
    const descriptionElement = document.createElement('span');
    descriptionElement.className = 'galleryDesc';
    item.append(image, label, descriptionElement);

    if (files.length > 1) {
      const count = document.createElement('span');
      count.className = 'galleryCount';
      count.textContent = `1 / ${files.length}`;
      item.appendChild(count);
    }

    galleryCards.push({ files, key, image, label, descriptionElement });
    item.addEventListener('click', () => {
      const [title, description] = I18N[currentLanguage].widgets[key];
      openLightbox(files, title, description);
    });
    galleryGrid.appendChild(item);
  }
};

const renderGallery = () => {
  const widgetTexts = I18N[currentLanguage].widgets;

  if (galleryCards.length === 0) {
    buildGallery();
  }

  for (const card of galleryCards) {
    const [title, description] = widgetTexts[card.key];
    card.image.alt = `${title} — ${description}`;
    card.label.textContent = title;
    card.descriptionElement.textContent = description;
  }
};

lightboxPrev.addEventListener('click', (event) => {
  event.stopPropagation();
  stepOpenedImage(-1);
});
lightboxNext.addEventListener('click', (event) => {
  event.stopPropagation();
  stepOpenedImage(1);
});

lightbox.addEventListener('keydown', (event) => {
  if (openedFiles.length < 2) {
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    stepOpenedImage(-1);
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    stepOpenedImage(1);
  }
});

document
  .getElementById('lightboxClose')
  .addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', (event) => {
  const rect = lightbox.getBoundingClientRect();
  const isInsideDialog =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;

  if (!isInsideDialog) {
    lightbox.close();
  }
});

/* ---------- Scroll reveal ---------- */

const revealElements = document.querySelectorAll('.reveal');

if (reducedMotion || !('IntersectionObserver' in window)) {
  revealElements.forEach((element) => element.classList.add('revealVisible'));
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealVisible');
          revealObserver.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 }
  );
  revealElements.forEach((element) => revealObserver.observe(element));
}

/* ---------- Misc ---------- */

document.getElementById('year').textContent = String(new Date().getFullYear());

applyLanguage(initialLanguage);

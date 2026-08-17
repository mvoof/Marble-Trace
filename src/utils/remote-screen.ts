import type { LayoutMonitor, MonitorBounds } from '@/types/widget-settings';

/**
 * Remote screens are layout monitors with no display behind them. Everything
 * that reasons about geometry treats them like any other monitor; only the two
 * places that touch the OS — opening overlay windows and reading attached
 * displays — have to tell them apart, and they do it through here rather than
 * by sniffing the name.
 */
export const isRemoteMonitor = (monitor: LayoutMonitor): boolean =>
  monitor.kind === 'remote';

export const isDisplayMonitor = (monitor: LayoutMonitor): boolean =>
  !isRemoteMonitor(monitor);

/**
 * Deep-copies a layout monitor. Several places rebuild the monitor list rather
 * than storing caller objects by reference, and every one of them has to carry
 * `kind` and `slug` across — a remote screen that loses them comes back as a
 * display with no device behind it.
 */
export const cloneMonitor = (monitor: LayoutMonitor): LayoutMonitor => ({
  name: monitor.name,
  bounds: { ...monitor.bounds },
  ...(monitor.kind ? { kind: monitor.kind } : {}),
  ...(monitor.slug ? { slug: monitor.slug } : {}),
  ...(monitor.fittedToDevice ? { fittedToDevice: true } : {}),
});

/** Common device sizes offered when adding a screen, in logical pixels. */
export const REMOTE_SCREEN_PRESETS = [
  { label: 'Tablet 10" landscape', width: 1280, height: 800 },
  { label: 'Tablet 10" portrait', width: 800, height: 1280 },
  { label: 'iPad landscape', width: 1180, height: 820 },
  { label: 'iPad portrait', width: 820, height: 1180 },
  { label: 'Phone landscape', width: 844, height: 390 },
  { label: 'Phone portrait', width: 390, height: 844 },
] as const;

/** Gap left between the desktop and a remote screen placed beside it. */
const REMOTE_SCREEN_GAP = 200;

/**
 * A remote screen must not overlap a real monitor: a widget is assigned to the
 * first monitor whose rectangle contains its centre, so an overlapping remote
 * rectangle would steal widgets off the desktop. New screens are parked to the
 * right of everything else.
 */
export const nextRemoteBounds = (
  monitors: LayoutMonitor[],
  width: number,
  height: number
): MonitorBounds => {
  if (monitors.length === 0) {
    return { x: 0, y: 0, width, height };
  }

  const right = Math.max(
    ...monitors.map((monitor) => monitor.bounds.x + monitor.bounds.width)
  );

  const top = Math.min(...monitors.map((monitor) => monitor.bounds.y));

  return { x: right + REMOTE_SCREEN_GAP, y: top, width, height };
};

/**
 * Cyrillic letters spelled out in Latin, so a screen named in Russian still
 * gets a slug that means something. Without it every such name collapses to
 * the fallback and the addresses read `/r/screen`, `/r/screen-2`.
 */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

const transliterate = (value: string): string =>
  value.replace(/[а-яё]/g, (letter) => CYRILLIC_TO_LATIN[letter] ?? '');

/**
 * URL-safe screen id derived from the name the user typed. Slugs must stay
 * stable once a device has the URL bookmarked, so this is only used to seed a
 * new screen, never to rewrite an existing one.
 */
export const slugFromName = (name: string): string => {
  const slug = transliterate(name.toLowerCase())
    // Accented Latin decomposes into a base letter plus a combining mark, and
    // dropping the mark keeps `Café` readable as `cafe`.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'screen';
};

/** Keeps generated slugs unique within a layout. */
export const uniqueSlug = (base: string, taken: string[]): string => {
  if (!taken.includes(base)) {
    return base;
  }

  let suffix = 2;

  while (taken.includes(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
};

/**
 * Alphabet for remote access tokens. Exactly 32 symbols, and that is
 * load-bearing twice over: 256 divides by it evenly, so picking a symbol by
 * `byte % length` stays unbiased, and each symbol carries a clean 5 bits.
 *
 * `i` and `l` are left out as the pair most easily misread; `0` and `1` are
 * absent from the digits, which is what makes `o` safe to keep.
 */
export const TOKEN_ALPHABET = '23456789abcdefghjkmnopqrstuvwxyz';

/**
 * Symbols per token — 75 bits. Far past guessing a service on a home network,
 * and short enough that the URL under the QR code can still be typed by hand
 * when a camera is not at hand.
 */
export const REMOTE_TOKEN_LENGTH = 15;

/**
 * Access token for the remote screens server, straight from the platform
 * CSPRNG.
 */
export const createRemoteToken = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(REMOTE_TOKEN_LENGTH));

  return Array.from(
    bytes,
    (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]
  ).join('');
};

/**
 * The scale that fits a screen of `bounds` into the browser viewport it is
 * actually rendered in, letterboxed rather than stretched: the layout was drawn
 * for one aspect ratio and distorting it would misplace every widget.
 */
export const fitScale = (
  bounds: MonitorBounds,
  viewportWidth: number,
  viewportHeight: number
): number => {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return 1;
  }

  return Math.min(viewportWidth / bounds.width, viewportHeight / bounds.height);
};

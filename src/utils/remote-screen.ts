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
  // Dropped here, a screen built for a browser source would come back painting
  // on black, and the widgets would sit on a black rectangle in the scene.
  ...(monitor.background ? { background: monitor.background } : {}),
});

/**
 * The slug a widget's own stream URL is served from.
 *
 * A `?widget=` URL narrows a screen to one widget's rectangle, which used to
 * mean the widget had to stand on a remote screen before it could be streamed
 * at all. This pseudo-screen carries every widget of the active layout instead,
 * so any of them — the ones on the game monitor included — has a URL that works
 * the moment the server is running. It is published like a screen and read like
 * one, but it is never listed as one: nothing opens it whole.
 */
export const WIDGET_SOURCE_SLUG = '__widgets';

/** What a remote screen paints behind its widgets unless told otherwise. */
export const DEFAULT_REMOTE_BACKGROUND = '#000000';

/**
 * Sizes offered when adding a screen, grouped by what is opening it.
 *
 * One list rather than one per kind of screen: a screen is a screen, and the
 * only thing that differs between a tablet and a browser source is what the
 * page paints behind the widgets. Monitor sizes are the broadcast canvases,
 * which is what a browser source is sized to — not to any physical panel.
 */
export const REMOTE_SCREEN_PRESET_GROUPS = [
  {
    id: 'monitor',
    presets: [
      { label: '1080p', width: 1920, height: 1080 },
      { label: '1440p', width: 2560, height: 1440 },
      { label: '720p', width: 1280, height: 720 },
    ],
  },
  {
    id: 'tablet',
    presets: [
      { label: 'Tablet 10" landscape', width: 1280, height: 800 },
      { label: 'Tablet 10" portrait', width: 800, height: 1280 },
      { label: 'iPad landscape', width: 1180, height: 820 },
      { label: 'iPad portrait', width: 820, height: 1180 },
    ],
  },
  {
    id: 'phone',
    presets: [
      { label: 'Phone landscape', width: 844, height: 390 },
      { label: 'Phone portrait', width: 390, height: 844 },
    ],
  },
] as const;

export const REMOTE_SCREEN_PRESETS: readonly {
  label: string;
  width: number;
  height: number;
}[] = REMOTE_SCREEN_PRESET_GROUPS.flatMap((group) => [...group.presets]);

/** Gap left between the desktop and a remote screen placed beside it. */
const REMOTE_SCREEN_GAP = 200;

/**
 * Whether two screen rectangles share any area. Half-open on the right and
 * bottom edge, matching `boundsContain`, so screens laid edge to edge — the
 * normal Windows arrangement — do not read as overlapping.
 */
export const boundsOverlap = (
  first: MonitorBounds,
  second: MonitorBounds
): boolean =>
  first.x < second.x + second.width &&
  second.x < first.x + first.width &&
  first.y < second.y + second.height &&
  second.y < first.y + first.height;

/**
 * Passes made looking for a free spot. Pushing clear of one screen can slide the
 * rectangle into the next, so the search repeats — but a dense arrangement can
 * bounce it back and forth, and the caller needs an answer either way.
 */
const CLEARANCE_PASSES = 8;

/**
 * The nearest position for `target` that overlaps none of `others`, reached by
 * pushing it out of each screen it hits along whichever axis is closest to an
 * edge. Dragging a screen to the far side of a monitor means crossing that
 * monitor, so an overlap in flight is normal and only the drop has to land
 * somewhere valid — a screen left overlapping would steal the widgets whose
 * centres fall inside it.
 *
 * Returns the target unchanged when no free spot is found within the passes;
 * the caller decides whether to keep the move at all.
 */
export const clearOfMonitors = (
  target: MonitorBounds,
  others: MonitorBounds[]
): MonitorBounds => {
  let placed = target;

  for (let pass = 0; pass < CLEARANCE_PASSES; pass += 1) {
    const hit = others.find((other) => boundsOverlap(other, placed));

    if (!hit) {
      return placed;
    }

    const pushLeft = hit.x - (placed.x + placed.width);
    const pushRight = hit.x + hit.width - placed.x;
    const pushUp = hit.y - (placed.y + placed.height);
    const pushDown = hit.y + hit.height - placed.y;

    const horizontal =
      Math.abs(pushLeft) <= Math.abs(pushRight) ? pushLeft : pushRight;
    const vertical = Math.abs(pushUp) <= Math.abs(pushDown) ? pushUp : pushDown;

    placed =
      Math.abs(horizontal) <= Math.abs(vertical)
        ? { ...placed, x: placed.x + horizontal }
        : { ...placed, y: placed.y + vertical };
  }

  return others.some((other) => boundsOverlap(other, placed)) ? target : placed;
};

/** Smallest rectangle covering the given screens, or a zero box for none. */
const coveringBounds = (monitors: LayoutMonitor[]): MonitorBounds => {
  if (monitors.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const left = Math.min(...monitors.map((monitor) => monitor.bounds.x));
  const top = Math.min(...monitors.map((monitor) => monitor.bounds.y));
  const right = Math.max(
    ...monitors.map((monitor) => monitor.bounds.x + monitor.bounds.width)
  );
  const bottom = Math.max(
    ...monitors.map((monitor) => monitor.bounds.y + monitor.bounds.height)
  );

  return { x: left, y: top, width: right - left, height: bottom - top };
};

/**
 * Where every remote screen should sit so the layout overview stays readable:
 * rows under the real desktop instead of one endless strip to its right. The
 * editor fits the whole desktop rectangle into the canvas, so each screen added
 * in a row shrinks every monitor on screen — wrapping keeps that box roughly as
 * wide as the desktop itself.
 *
 * Returns the new bounds by monitor name; screens that are already in place get
 * an entry too, and the caller filters those out by comparing.
 */
export const remoteScreenGrid = (
  monitors: LayoutMonitor[]
): Record<string, MonitorBounds> => {
  const remotes = monitors.filter(isRemoteMonitor);

  if (remotes.length === 0) {
    return {};
  }

  const desktop = coveringBounds(monitors.filter(isDisplayMonitor));
  const widest = Math.max(...remotes.map((monitor) => monitor.bounds.width));
  // With no display to line up under, there is no width to match, so the grid
  // aims for a square block instead.
  const rowWidth =
    desktop.width > 0
      ? Math.max(desktop.width, widest)
      : widest * Math.ceil(Math.sqrt(remotes.length));

  const startX = desktop.x;
  let rowY = desktop.y + desktop.height + REMOTE_SCREEN_GAP;
  let cursorX = startX;
  let rowHeight = 0;

  const placed: Record<string, MonitorBounds> = {};

  for (const monitor of remotes) {
    const { width, height } = monitor.bounds;

    if (cursorX > startX && cursorX + width > startX + rowWidth) {
      rowY += rowHeight + REMOTE_SCREEN_GAP;
      cursorX = startX;
      rowHeight = 0;
    }

    placed[monitor.name] = { x: cursorX, y: rowY, width, height };
    cursorX += width + REMOTE_SCREEN_GAP;
    rowHeight = Math.max(rowHeight, height);
  }

  return placed;
};

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

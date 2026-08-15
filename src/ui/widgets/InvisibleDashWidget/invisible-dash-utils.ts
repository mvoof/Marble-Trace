import type { InvisibleDashWidgetSettings } from '@/types/widget-settings';
import type { RpmZone } from '@utils/car-signals';
import { rpmZoneDigitColor } from '@utils/car-signals';

/**
 * Color for a digit driven by the revs, using the widget's own zone palette.
 * Null below the high zone — the readout only takes on color when the shift
 * point is close, so it does not flicker through a normal lap.
 */
export const zoneDigitColor = (
  zone: RpmZone,
  settings: InvisibleDashWidgetSettings
): string | null =>
  rpmZoneDigitColor(zone, {
    high: settings.rpmColorHigh,
    shift: settings.rpmColorShift,
    limit: settings.rpmColorLimit,
  });

/** Fill color of the shift bar at the given zone — it is colored all the way down. */
export const shiftBarColor = (
  zone: RpmZone,
  settings: InvisibleDashWidgetSettings
): string => {
  if (zone === 'blink') {
    return settings.rpmColorLimit;
  }

  if (zone === 'shift') {
    return settings.rpmColorShift;
  }

  if (zone === 'high') {
    return settings.rpmColorHigh;
  }

  if (zone === 'mid') {
    return settings.rpmColorMid;
  }

  return settings.rpmColorLow;
};

/**
 * Text the gear digit shows. iRacing reports 0 for neutral and -1 for reverse,
 * and the projection has no room for a word.
 */
export const formatGear = (gear: number): string => {
  if (gear < 0) {
    return 'R';
  }

  if (gear === 0) {
    return 'N';
  }

  return String(gear);
};

// How far the readout tilts away from the driver at full depth. Steep enough
// to read as lying on the road rather than on the glass; past this the glyphs
// foreshorten faster than they gain distance.
const MAX_TILT_DEG = 55;
// Distant text also reads smaller and dimmer — both are what sells the depth,
// and neither of them touches glyph sharpness the way a blur would.
const MAX_SHRINK = 0.45;
const MAX_FADE = 0.45;
/**
 * The readout is laid out at this multiple of its final size and scaled back
 * down, so the tilted layer is rasterized from a supersampled bitmap and the
 * glyph edges stay crisp instead of smearing.
 */
export const SUPERSAMPLE = 2;

export interface DepthTransform {
  transform: string;
  opacity: number;
  /** The factor the transform shrinks by — the stylesheets floor sizes against it. */
  scale: number;
}

export const computeDepthTransform = (depth: number): DepthTransform => {
  const amount = Math.min(Math.max(depth, 0), 100) / 100;
  // Negative: the windscreen leans back toward the driver, so its lower edge is
  // the far one, out by the bonnet, and the top edge is the near one, up by the
  // driver's head. The strip has to foreshorten downward to lie on that glass —
  // tilting the other way reads as a table top flipped away from you.
  const tilt = -amount * MAX_TILT_DEG;
  const scale = (1 - amount * MAX_SHRINK) / SUPERSAMPLE;

  return {
    transform: `scale(${scale.toFixed(4)}) rotateX(${tilt.toFixed(2)}deg)`,
    opacity: 1 - amount * MAX_FADE,
    scale,
  };
};

const HEX_PAIR_LENGTH = 2;
const HEX_RADIX = 16;

const tintToRgb = (hex: string): [number, number, number] => {
  const body = hex.replace('#', '');
  const parts = [0, 1, 2].map((index) =>
    parseInt(
      body.slice(index * HEX_PAIR_LENGTH, (index + 1) * HEX_PAIR_LENGTH),
      HEX_RADIX
    )
  );

  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
};

const CORE_RADIUS_PX = 12;
const HALO_RADIUS_PX = 34;
const CORE_ALPHA = 0.9;
const HALO_ALPHA = 0.5;

// The glow radii are absolute px, so on a shrunk widget the halo would spread
// several glyph widths wide and swallow the digits it is meant to lift. It
// follows the widget's own scale instead, with a floor so it never disappears
// on a small dash.
const MIN_BLOOM_SCALE = 0.5;

/**
 * Two-layer bloom in the projection tint: a tight core and a wide halo, the way
 * a real head-up display scatters in the glass. Contour mode passes none.
 * `readoutScale` is the widget's height over its design height — what the
 * readout itself is sized from.
 */
export const computeBloom = (
  tint: string,
  intensity: number,
  readoutScale: number
): string => {
  const amount = Math.min(Math.max(intensity, 0), 100) / 100;

  if (amount === 0) {
    return 'none';
  }

  const spread = amount * Math.min(Math.max(readoutScale, MIN_BLOOM_SCALE), 1);
  const [red, green, blue] = tintToRgb(tint);
  const core = `rgba(${red}, ${green}, ${blue}, ${(CORE_ALPHA * amount).toFixed(2)})`;
  const halo = `rgba(${red}, ${green}, ${blue}, ${(HALO_ALPHA * amount).toFixed(2)})`;

  return `0 0 ${(CORE_RADIUS_PX * spread).toFixed(1)}px ${core}, 0 0 ${(HALO_RADIUS_PX * spread).toFixed(1)}px ${halo}`;
};

export interface BackdropStyle {
  background: string;
}

/**
 * The plate behind the digits: the color's own alpha is the whole treatment.
 * Where it lands is the user's call (`backdropScope`): on the clusters, leaving
 * the empty middle clear, or on the whole strip.
 *
 * There is deliberately no backdrop blur here. The overlay is a transparent
 * window: Windows composites the sim's frame *underneath* it, so the webview
 * has no game pixels to blur and the filter would do nothing over the track.
 */
export const computeBackdrop = (color: string): BackdropStyle => ({
  background: color,
});

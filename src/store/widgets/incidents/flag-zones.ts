import type { IncidentPoint } from '@/types/bindings';

/**
 * A stretch of the lap worth warning about.
 *
 * iRacing never says where a yellow is. Both the yellow and the debris bit live
 * in the session-wide `SessionFlags`, and `CarIdxSessionFlags` carries only the
 * flags addressed to one driver — so a flagged stretch of the lap cannot be
 * read off the flag bits at all. What can be located is the trouble itself: the
 * backend finds cars stopped on the racing line or sitting off it, and each one
 * has a real coordinate. A zone is the warning distance around one of those.
 *
 * `startPct`/`endPct` are lap fractions and may wrap past the start/finish line
 * (`endPct < startPct`).
 */
export interface FlagZone {
  startPct: number;
  endPct: number;
  /** False once the car recovered and the zone is only lingering. */
  isActive: boolean;
}

/**
 * How far ahead of the incident the warning starts. This is the number that
 * matters: the driver needs it on the approach, while there is still time to
 * lift. A marshal waves from well before the scene for the same reason.
 */
const WARNING_BEFORE_M = 250;

/** How far past the incident the warning runs on. */
const WARNING_AFTER_M = 100;

/**
 * Two zones closer than this are one incident seen twice — a spin usually
 * strands two cars within a few metres of each other.
 */
const MERGE_GAP_PCT = 0.005;

/** Below this the track length is unknown and no zone can be sized. */
const MIN_TRACK_LENGTH_M = 1;

const normalizePct = (pct: number): number => {
  const wrapped = pct % 1;

  return wrapped < 0 ? wrapped + 1 : wrapped;
};

/**
 * A zone on an unwrapped axis, before the lap fraction is folded back into
 * `[0, 1)`. An incident just after the start/finish line starts at a negative
 * fraction here and one just before it ends past 1, which is what lets two
 * halves of the same hazard be recognised as touching.
 */
interface RawZone {
  startRaw: number;
  endRaw: number;
  isActive: boolean;
}

/**
 * Builds the warning zones for the incidents the backend located.
 *
 * The distances are metres rather than a lap fraction so the zone means the
 * same thing everywhere: 250 m of warning is 250 m of warning on a short oval
 * and at Spa, even though the share of the lap differs by a factor of ten.
 */
export const computeIncidentZones = (
  incidents: IncidentPoint[],
  trackLengthM: number
): FlagZone[] => {
  if (incidents.length === 0 || trackLengthM < MIN_TRACK_LENGTH_M) {
    return [];
  }

  const beforePct = WARNING_BEFORE_M / trackLengthM;
  const afterPct = WARNING_AFTER_M / trackLengthM;

  // A zone longer than the lap would wrap onto itself and read as "everywhere",
  // which is the one thing this drawing must never say.
  if (beforePct + afterPct >= 1) {
    return [];
  }

  const sorted = [...incidents].sort(
    (left, right) => left.lapDistPct - right.lapDistPct
  );

  const raw: RawZone[] = [];

  for (const incident of sorted) {
    const startRaw = incident.lapDistPct - beforePct;
    const endRaw = incident.lapDistPct + afterPct;
    const previous = raw[raw.length - 1];

    // Sorted by position, so a zone can only ever merge with the last one.
    if (previous && startRaw - previous.endRaw <= MERGE_GAP_PCT) {
      previous.endRaw = Math.max(previous.endRaw, endRaw);
      previous.isActive = previous.isActive || incident.isActive;

      continue;
    }

    raw.push({ startRaw, endRaw, isActive: incident.isActive });
  }

  // The first and last zones may be one incident straddling the start/finish
  // line, which a sort by lap percentage always splits in two.
  if (raw.length > 1) {
    const first = raw[0];
    const last = raw[raw.length - 1];

    if (first.startRaw + 1 - last.endRaw <= MERGE_GAP_PCT) {
      raw.pop();
      raw[0] = {
        startRaw: last.startRaw - 1,
        endRaw: first.endRaw,
        isActive: first.isActive || last.isActive,
      };
    }
  }

  return raw.map(({ startRaw, endRaw, isActive }) => {
    // Merged all the way round: the zone is the lap, and drawing it as a wrap
    // would fold it onto itself.
    if (endRaw - startRaw >= 1) {
      return { startPct: 0, endPct: 1, isActive };
    }

    return {
      startPct: normalizePct(startRaw),
      endPct: normalizePct(endRaw),
      isActive,
    };
  });
};

/** Lap fraction the zone covers, following the wrap when there is one. */
export const flagZoneLengthPct = (zone: FlagZone): number => {
  const length = zone.endPct - zone.startPct;

  return length < 0 ? length + 1 : length;
};

/**
 * Splits a zone that crosses the start/finish line into the one or two
 * non-wrapping ranges a linear surface can draw.
 */
export const splitFlagZoneAtStartFinish = (
  zone: FlagZone
): Array<{ startPct: number; endPct: number }> => {
  if (zone.endPct >= zone.startPct) {
    return [{ startPct: zone.startPct, endPct: zone.endPct }];
  }

  return [
    { startPct: zone.startPct, endPct: 1 },
    { startPct: 0, endPct: zone.endPct },
  ];
};

/** Half a lap either way — the window the relative strip shows. */
const WINDOW_HALF_PCT = 0.5;

const wrapDiff = (diff: number): number => {
  let wrapped = diff;

  if (wrapped < -WINDOW_HALF_PCT) {
    wrapped += 1;
  }

  if (wrapped >= WINDOW_HALF_PCT) {
    wrapped -= 1;
  }

  return wrapped;
};

/**
 * Places a zone on the relative strip, whose window is one lap centred on the
 * player. Coordinates are lap fractions relative to the player, in
 * `[-0.5, 0.5]`; a zone straddling the far edge of the window comes back as two
 * ranges, which is the same seam the strip's own dots wrap at.
 */
export const projectFlagZoneToWindow = (
  zone: FlagZone,
  playerPct: number
): Array<{ startDiff: number; endDiff: number }> => {
  const length = Math.min(flagZoneLengthPct(zone), 1);

  if (length >= 1) {
    return [{ startDiff: -WINDOW_HALF_PCT, endDiff: WINDOW_HALF_PCT }];
  }

  const startDiff = wrapDiff(normalizePct(zone.startPct) - playerPct);
  const endDiff = startDiff + length;

  if (endDiff <= WINDOW_HALF_PCT) {
    return [{ startDiff, endDiff }];
  }

  return [
    { startDiff, endDiff: WINDOW_HALF_PCT },
    { startDiff: -WINDOW_HALF_PCT, endDiff: endDiff - 1 },
  ];
};

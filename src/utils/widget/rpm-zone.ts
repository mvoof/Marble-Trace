export interface RpmZoneColors {
  low: string;
  mid: string;
  high: string;
  limit: string;
}

const HIGH_ZONE_PCT = 0.7;
const MID_ZONE_PCT = 0.35;

export type RpmSubZone = 'low' | 'mid' | 'high' | 'limit';

/** Maps a 0..1 fraction of blinkRpm to a sub-zone — shared by RpmLightsWidget's
 * per-LED gradient and RaceDash's low/mid/high ring zones. */
export const rpmSubZoneForPct = (pct: number): RpmSubZone => {
  if (pct >= 1) {
    return 'limit';
  }

  if (pct >= HIGH_ZONE_PCT) {
    return 'high';
  }

  if (pct >= MID_ZONE_PCT) {
    return 'mid';
  }

  return 'low';
};

export const rpmZoneColorByPct = (pct: number, colors: RpmZoneColors): string =>
  colors[rpmSubZoneForPct(pct)];

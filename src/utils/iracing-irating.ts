/**
 * Projected iRating delta — frontend Elo-based ESTIMATE.
 *
 * iRacing live telemetry does NOT expose per-driver iRating change; the real
 * value only arrives in post-session results. This module computes a coarse
 * projection based on a simplified version of the iRacing iRating formula:
 *
 *   expected_score_i = Σ_{j ≠ i} 1 / (1 + 10^((iR_i − iR_j) / 400))
 *   actual_score_i   = (N − pos_i) (1.0 for win, 0 for last)
 *   delta_i          ≈ K · (actual_score_i − expected_score_i)
 *
 * Where K is a constant scale factor — the real iRacing K depends on the
 * driver's iRating bracket and series weight, but a flat K ≈ 1 produces a
 * sane order-of-magnitude estimate suitable for a HUD.
 *
 * Pilots are matched **within their car class** because iRacing computes iR
 * per-class in multi-class races.
 */

interface IrDeltaInput {
  carIdx: number;
  classId: number;
  classPosition: number; // 1 = class winner
  iRating: number;
}

const K_FACTOR = 1.0;
const ELO_DIVISOR = 400;

/**
 * Returns a Map<carIdx, projected ΔiR (rounded integer)> for every driver
 * with a positive iRating and a valid class position. Drivers without iR
 * (e.g. rookies with 0) are skipped.
 */
export const computeProjectedIrDelta = (
  drivers: IrDeltaInput[]
): Map<number, number> => {
  const result = new Map<number, number>();

  // Bucket by class — Elo math runs only against same-class opponents.
  const buckets = new Map<number, IrDeltaInput[]>();

  for (const d of drivers) {
    if (d.iRating <= 0 || d.classPosition <= 0) continue;

    const bucket = buckets.get(d.classId);
    if (bucket) bucket.push(d);
    else buckets.set(d.classId, [d]);
  }

  for (const bucket of buckets.values()) {
    const n = bucket.length;
    if (n < 2) continue;

    for (const driver of bucket) {
      let expected = 0;

      for (const other of bucket) {
        if (other.carIdx === driver.carIdx) continue;
        expected +=
          1 /
          (1 + Math.pow(10, (driver.iRating - other.iRating) / ELO_DIVISOR));
      }

      const actual = n - driver.classPosition;
      const delta = K_FACTOR * (actual - expected);

      result.set(driver.carIdx, Math.round(delta));
    }
  }

  return result;
};

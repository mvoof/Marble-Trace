/**
 * Projected iRating change — Turbo87 algorithm.
 *
 * Based on https://github.com/Turbo87/irating-rs and the irdashies
 * implementation. Uses exponential chance model (not standard Elo) which
 * better matches iRacing's actual iR computation.
 *
 * iRacing live telemetry does NOT expose per-driver iRating change; the real
 * value only arrives in post-session results. This module computes a projected
 * estimate based on current race positions.
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

interface RaceResult {
  carIdx: number;
  finishRank: number;
  startIRating: number;
  started: boolean;
}

const chance = (a: number, b: number, factor: number): number => {
  const expA = Math.exp(-a / factor);
  const expB = Math.exp(-b / factor);
  return ((1 - expA) * expB) / ((1 - expB) * expA + (1 - expA) * expB);
};

const calculateIRatingGain = (
  raceResults: RaceResult[]
): Map<number, number> => {
  const result = new Map<number, number>();
  const br1 = 1600 / Math.LN2;
  const numRegistrations = raceResults.length;

  if (numRegistrations === 0) return result;

  const numStarters = raceResults.filter((r) => r.started).length;
  const numNonStarters = numRegistrations - numStarters;

  const chances: number[][] = raceResults.map((a) =>
    raceResults.map((b) => chance(a.startIRating, b.startIRating, br1))
  );

  const expectedScores: number[] = chances.map(
    (row) => row.reduce((sum, val) => sum + val, 0) - 0.5
  );

  const fudgeFactors: number[] = raceResults.map((r) => {
    if (!r.started) return 0;
    const x = numRegistrations - numNonStarters / 2;
    return (x / 2 - r.finishRank) / 100;
  });

  let sumChangesStarters = 0;
  const changesStarters: (number | null)[] = raceResults.map((r, i) => {
    if (!r.started) return null;
    if (numStarters === 0) return 0;
    const change =
      ((numRegistrations - r.finishRank - expectedScores[i] - fudgeFactors[i]) *
        200) /
      numStarters;
    sumChangesStarters += change;
    return change;
  });

  const expectedScoreNonStartersList: (number | null)[] = raceResults.map(
    (r, i) => (!r.started ? expectedScores[i] : null)
  );

  const sumExpectedScoreNonStarters = expectedScoreNonStartersList
    .filter((s): s is number => s !== null)
    .reduce((sum, val) => sum + val, 0);

  const avgExpectedScoreNonStarters =
    numNonStarters > 0 ? sumExpectedScoreNonStarters / numNonStarters : 0;

  const changesNonStarters: (number | null)[] =
    expectedScoreNonStartersList.map((expected) => {
      if (expected === null) return null;
      if (numNonStarters === 0 || avgExpectedScoreNonStarters === 0) return 0;
      return (
        (-sumChangesStarters / numNonStarters) *
        (expected / avgExpectedScoreNonStarters)
      );
    });

  for (let i = 0; i < raceResults.length; i++) {
    const change = changesStarters[i] ?? changesNonStarters[i] ?? 0;
    result.set(raceResults[i].carIdx, Math.round(change));
  }

  return result;
};

/**
 * Returns a Map<carIdx, projected ΔiR (rounded integer)> for every driver
 * with a positive iRating and a valid class position. Drivers without iR
 * (e.g. rookies with 0) are skipped.
 */
export const computeProjectedIrDelta = (
  drivers: IrDeltaInput[]
): Map<number, number> => {
  const result = new Map<number, number>();

  // Bucket by class — iR math runs only against same-class opponents.
  const buckets = new Map<number, IrDeltaInput[]>();

  for (const d of drivers) {
    if (d.iRating <= 0 || d.classPosition <= 0) continue;

    const bucket = buckets.get(d.classId);
    if (bucket) bucket.push(d);
    else buckets.set(d.classId, [d]);
  }

  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;

    const raceResults: RaceResult[] = bucket.map((d) => ({
      carIdx: d.carIdx,
      finishRank: d.classPosition,
      startIRating: d.iRating,
      started: true,
    }));

    const deltas = calculateIRatingGain(raceResults);
    for (const [carIdx, delta] of deltas) {
      result.set(carIdx, delta);
    }
  }

  return result;
};

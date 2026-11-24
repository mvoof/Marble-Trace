import { describe, expect, it } from 'vitest';
import type { CarIdentity } from '@shared/contracts/car-identity';
import { StandingsOrderStore } from './standings-order.store';

const entry = (carIdx: number, overall: number, inClass = overall) =>
  ({
    carIdx,
    carClassId: 1,
    livePosition: overall,
    liveClassPosition: inClass,
  }) as CarIdentity;

describe('StandingsOrderStore', () => {
  it.each([
    { ranks: [4, 4], classRanks: [4, 5] },
    { ranks: [4, 5], classRanks: [4, 4] },
  ])(
    'holds moves with conflicting destinations ($ranks / $classRanks)',
    ({ ranks, classRanks }) => {
      const order = new StandingsOrderStore();

      try {
        order.process([entry(1, 1), entry(2, 2)], true, 0);
        order.process(
          [
            entry(1, ranks[0], classRanks[0]),
            entry(2, ranks[1], classRanks[1]),
          ],
          true,
          100
        );
        order.process(null, true, 1000);

        expect(order.renderedRanks.get(1)).toEqual({ overall: 1, inClass: 1 });
        expect(order.renderedRanks.get(2)).toEqual({ overall: 2, inClass: 2 });
        expect(order.hasPending()).toBe(true);

        order.process(
          [entry(1, ranks[0], classRanks[0]), entry(2, 5)],
          true,
          1100
        );

        expect(order.renderedRanks.get(1)).toEqual({ overall: 4, inClass: 4 });
        expect(order.renderedRanks.get(2)).toEqual({ overall: 2, inClass: 2 });
        order.process(null, true, 2000);
        expect(order.renderedRanks.get(2)).toEqual({ overall: 5, inClass: 5 });
      } finally {
        order.dispose();
      }
    }
  );

  it('leaves contested initial positions blank until the ranks resolve', () => {
    const order = new StandingsOrderStore();

    try {
      const holding = entry(1, 1);
      order.process([holding, entry(2, 1), entry(3, 3)], true, 0);
      expect(order.renderedRanks.get(1)).toEqual({ overall: 0, inClass: 0 });
      expect(order.renderedRanks.get(2)).toEqual({ overall: 0, inClass: 0 });

      order.process([holding, entry(2, 2), entry(3, 3)], true, 100);

      expect(order.renderedRanks.get(1)?.overall).toBe(1);
      expect(order.renderedRanks.get(2)?.overall).toBe(2);
      expect(order.renderedRanks.get(3)?.overall).toBe(3);
    } finally {
      order.dispose();
    }
  });

  it('places a newly ranked car without changing the timer of an unrelated swap', () => {
    const order = new StandingsOrderStore();

    try {
      order.process(
        [entry(1, 1), entry(2, 0), entry(3, 3), entry(4, 4)],
        true,
        0
      );
      order.process(
        [entry(1, 1), entry(2, 0), entry(3, 4), entry(4, 3)],
        true,
        100
      );
      order.process(
        [entry(1, 2), entry(2, 1), entry(3, 4), entry(4, 3)],
        true,
        200
      );

      expect(
        [...order.renderedRanks.values()].map((rank) => rank.overall)
      ).toEqual([2, 1, 3, 4]);
      order.process(null, true, 999);
      expect(order.renderedRanks.get(3)?.overall).toBe(3);
      order.process(null, true, 1000);
      expect(order.renderedRanks.get(3)?.overall).toBe(4);
      expect(order.renderedRanks.get(4)?.overall).toBe(3);
    } finally {
      order.dispose();
    }
  });
});

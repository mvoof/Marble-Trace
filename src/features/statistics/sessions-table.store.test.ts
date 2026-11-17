import { describe, expect, it, vi } from 'vitest';

import type {
  SessionFilter,
  SessionPage,
} from '@shared/contracts/generated/bindings';
import {
  SESSION_KINDS,
  SessionsTableStore,
  sessionFilterOf,
} from './sessions-table.store';

const DAY_S = 24 * 60 * 60;
const NOW_S = 1_000 * DAY_S;

const state = {
  period: 'all' as const,
  range: null,
  text: '',
  kinds: [...SESSION_KINDS],
  withBots: true,
};

const servedPage = (page: number): SessionPage => ({
  rows: [],
  total: 45,
  page,
  pageSize: 20,
});

describe('sessionFilterOf', () => {
  it('counts a quick period back from now, open at the end', () => {
    const filter = sessionFilterOf({ ...state, period: '30d' }, NOW_S);

    expect([filter.fromS, filter.toS]).toEqual([NOW_S - 30 * DAY_S, null]);
    expect(sessionFilterOf(state, NOW_S).fromS).toBeNull();
  });

  it('takes a picked range to the end of its last day', () => {
    const filter = sessionFilterOf(
      {
        ...state,
        period: 'range',
        range: { fromS: 10 * DAY_S, lastDayS: 12 * DAY_S },
      },
      NOW_S
    );

    expect([filter.fromS, filter.toS]).toEqual([10 * DAY_S, 13 * DAY_S]);
  });

  it('lists the kinds in a fixed order', () => {
    const filter = sessionFilterOf(
      { ...state, kinds: ['race', 'practice'] },
      NOW_S
    );

    expect(filter.kinds).toEqual(['practice', 'race']);
  });
});

describe('SessionsTableStore', () => {
  it('goes back to the first page when the filter changes', async () => {
    const loadPage = vi.fn(async (_filter: SessionFilter, page: number) =>
      servedPage(page)
    );
    const store = new SessionsTableStore(loadPage);

    store.setPage(2);
    await vi.waitFor(() => expect(store.page).toBe(2));

    store.toggleKind('race');
    await vi.waitFor(() => expect(store.page).toBe(0));

    const [filter, page] = loadPage.mock.calls.at(-1)!;
    expect(page).toBe(0);
    expect(filter.kinds).not.toContain('race');
  });

  it('keeps only the answer to the latest request', async () => {
    let answerFirst: (page: SessionPage) => void = () => {};
    const loadPage = vi
      .fn<(filter: SessionFilter, page: number) => Promise<SessionPage>>()
      .mockImplementationOnce(
        () => new Promise((resolve) => (answerFirst = resolve))
      )
      .mockImplementationOnce(async () => ({ ...servedPage(0), total: 3 }));
    const store = new SessionsTableStore(loadPage);

    const first = store.reload();
    store.setText('spa');
    await vi.waitFor(() => expect(store.total).toBe(3));
    answerFirst({ ...servedPage(0), total: 99 });
    await first;

    expect(store.total).toBe(3);
  });
});

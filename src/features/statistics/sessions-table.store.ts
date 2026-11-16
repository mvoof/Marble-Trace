import { makeAutoObservable, runInAction } from 'mobx';

import type {
  RecentSession,
  SessionFilter,
  SessionKind,
  SessionPage,
} from '@shared/contracts/generated/bindings';

/** The quick spans of the period switch; `range` is a picked date range. */
export const SESSION_PERIODS = ['7d', '30d', '90d', 'all'] as const;

export type SessionPeriod = (typeof SESSION_PERIODS)[number] | 'range';

export const SESSION_KINDS: SessionKind[] = [
  'practice',
  'qualify',
  'race',
  'test',
  'timeTrial',
];

const PERIOD_DAYS: Record<(typeof SESSION_PERIODS)[number], number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
};

const SECONDS_PER_DAY = 24 * 60 * 60;
const MS_PER_SECOND = 1000;

/** A date range picked, local midnights, unix seconds; the end is inclusive. */
export interface PickedRange {
  fromS: number;
  /** The start of the last day in the range. */
  lastDayS: number;
}

/** What the store asks the backend through. */
export type SessionsPageLoader = (
  filter: SessionFilter,
  page: number
) => Promise<SessionPage>;

/**
 * The filter in force and the page it asks for. `nowS` is when a quick
 * period counts back from.
 */
export const sessionFilterOf = (
  state: {
    period: SessionPeriod;
    range: PickedRange | null;
    text: string;
    kinds: SessionKind[];
    withBots: boolean;
  },
  nowS: number
): SessionFilter => {
  let fromS: number | null = null;
  let toS: number | null = null;

  if (state.period === 'range' && state.range !== null) {
    fromS = state.range.fromS;
    toS = state.range.lastDayS + SECONDS_PER_DAY;
  } else if (state.period !== 'range') {
    const days = PERIOD_DAYS[state.period];
    fromS = days === null ? null : nowS - days * SECONDS_PER_DAY;
  }

  return {
    fromS,
    toS,
    text: state.text,
    kinds: SESSION_KINDS.filter((kind) => state.kinds.includes(kind)),
    withBots: state.withBots,
  };
};

/**
 * The recent sessions table on Home: its filter, kept for the app run and
 * never saved, and the page the backend served for it.
 */
export class SessionsTableStore {
  period: SessionPeriod = 'all';
  range: PickedRange | null = null;
  text = '';
  kinds: SessionKind[] = [...SESSION_KINDS];
  withBots = true;
  page = 0;

  rows: RecentSession[] = [];
  total = 0;
  pageSize = 0;
  loaded = false;

  /** Answers older than the latest request are dropped. */
  private requestId = 0;

  constructor(private loadPage: SessionsPageLoader) {
    makeAutoObservable<SessionsTableStore, 'loadPage' | 'requestId'>(this, {
      loadPage: false,
      requestId: false,
    });
  }

  get filter(): SessionFilter {
    return sessionFilterOf(this, Date.now() / MS_PER_SECOND);
  }

  setPeriod(period: (typeof SESSION_PERIODS)[number]) {
    this.period = period;
    this.range = null;
    this.reloadFromFirstPage();
  }

  /** `null` clears the range back to the whole history. */
  setRange(range: PickedRange | null) {
    this.range = range;
    this.period = range === null ? 'all' : 'range';
    this.reloadFromFirstPage();
  }

  setText(text: string) {
    this.text = text;
    this.reloadFromFirstPage();
  }

  toggleKind(kind: SessionKind) {
    this.kinds = this.kinds.includes(kind)
      ? this.kinds.filter((shown) => shown !== kind)
      : [...this.kinds, kind];
    this.reloadFromFirstPage();
  }

  setWithBots(withBots: boolean) {
    this.withBots = withBots;
    this.reloadFromFirstPage();
  }

  /** 0 first. */
  setPage(page: number) {
    this.page = page;
    void this.reload();
  }

  /** Asks for the current page again: a file was read, or the filter moved. */
  async reload() {
    this.requestId += 1;
    const requestId = this.requestId;

    try {
      const served = await this.loadPage(this.filter, this.page);

      if (requestId !== this.requestId) {
        return;
      }

      runInAction(() => {
        this.rows = served.rows;
        this.total = served.total;
        this.page = served.page;
        this.pageSize = served.pageSize;
        this.loaded = true;
      });
    } catch (error) {
      console.error('Sessions page not loaded', error);
    }
  }

  private reloadFromFirstPage() {
    this.page = 0;
    void this.reload();
  }
}

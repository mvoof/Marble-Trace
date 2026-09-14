import type { SessionEntry, SessionFrame } from '@/types/bindings';

// Mock builders for the session-timing domain — the session clock, the lap
// limit and the session header the timer draws. Pure: each takes a partial
// override and returns a *complete* frame typed from the generated bindings,
// so a field added to the contract breaks this file rather than leaking
// silently into every fixture. Nothing here touches a store.

/** Where the race sits in the recorded weekend's session list. */
export const RACE_SESSION_NUM = 2;

/**
 * What iRacing leaves in `SessionTimeRemain` for a session that does not end on
 * the clock: a week. It is the sentinel the timer reads as "no time limit", so
 * a lap-limited scenario has to carry it rather than a zero — a zero is a
 * session that has just run out, which is a different readout.
 */
export const UNLIMITED_REMAIN_S = 7 * 24 * 3600;

/**
 * Mid-race on a timed session, a little over four minutes to run. The base
 * every timing scenario states its difference against.
 */
export const mockSession = (
  overrides: Partial<SessionFrame> = {}
): SessionFrame => ({
  session_time: 1249.7,
  session_time_remain: 250.3,
  session_state: 'Racing',
  session_flags: 0,
  session_num: RACE_SESSION_NUM,
  session_time_of_day: 74449,
  session_laps_remain_ex: 32767,
  player_car_idx: 17,
  player_car_flags: 0,
  ...overrides,
});

/**
 * The race entry of the weekend's session list — what says whether the session
 * ends on a clock or on a lap count, and what the header is labelled with.
 */
export const mockSessionEntry = (
  overrides: Partial<SessionEntry> = {}
): SessionEntry => ({
  sessionType: 'Race',
  sessionTypeLabel: 'Race',
  sessionLaps: 'unlimited',
  resultsPositions: [],
  ...overrides,
});

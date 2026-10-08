/**
 * Choices several widgets offer, or code outside a widget reads, declared once.
 * A widget's `settings-schema.ts` wraps one in `choice(...)`; the type beside
 * it is what the rest of the app names the value by.
 *
 * A choice only one widget has stays in that widget's schema.
 */

/**
 * Whether other drivers are drawn in a qualifying session: `auto` blanks them
 * in solo qualifying, where the cars are not on track with you.
 */
export const QUALIFYING_VISIBILITY = ['always', 'auto', 'never'] as const;
export type QualifyingVisibility = (typeof QUALIFYING_VISIBILITY)[number];

export const ROW_PADDING = ['narrow', 'medium', 'wide'] as const;
export type RowPadding = (typeof ROW_PADDING)[number];

/**
 * How the SR value is drawn: `badge` is the two-tone chip (class letter on the
 * class color, rating on a darker half), `plain` is the bare number in the class
 * color, and `dark` keeps the letter's colored plate but puts the number in the
 * class color on a near-black ground.
 */
export const LIC_BADGE_STYLE = ['badge', 'plain', 'dark'] as const;
export type LicBadgeStyle = (typeof LIC_BADGE_STYLE)[number];

export const LAP_DELTA_REFERENCE = [
  'personal_best',
  'personal_optimal',
  'session_best',
  'session_optimal',
  'session_last',
] as const;
export type LapDeltaReference = (typeof LAP_DELTA_REFERENCE)[number];

/**
 * How a flag zone is painted: `filled` covers the whole track surface,
 * `outline` keeps the same colour and opacity but only along each edge of it,
 * leaving the surface underneath visible.
 */
export const FLAG_ZONE_STYLE = ['filled', 'outline'] as const;
export type FlagZoneStyle = (typeof FLAG_ZONE_STYLE)[number];

/** The standings table's view — cycled by a hotkey, in this order. */
export const STANDINGS_VIEW_MODE = ['all', 'grouped', 'cycling'] as const;
export type StandingsViewMode = (typeof STANDINGS_VIEW_MODE)[number];

/*
 * Every widget that prints a position number carries its own `useLivePositions`
 * flag with these semantics. On: rank by order on track, recomputed from covered
 * distance every tick. Off: the sim's official number, which only refreshes when
 * a car crosses start/finish — outside a race that order is by best lap. The flag
 * is not conditioned on session type; practice, qualifying and race behave alike.
 */

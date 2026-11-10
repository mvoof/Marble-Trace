import type { CSSProperties, ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import type { LucideIcon } from 'lucide-react';

import styles from './StatChip.module.scss';

/**
 * The chip's color. A caller with a color of its own — a license class, a pit
 * state — sets the chip's variables through `className` instead.
 */
export type StatChipTone =
  | 'accent'
  | 'positive'
  | 'info'
  | 'special'
  | 'danger'
  | 'lapped'
  | 'neutral'
  | 'muted'
  | 'licenseA'
  | 'licenseB'
  | 'licenseC'
  | 'licenseD'
  | 'licenseR';

const TONE_CLASS: Record<StatChipTone, string> = {
  accent: styles.toneAccent,
  positive: styles.tonePositive,
  info: styles.toneInfo,
  special: styles.toneSpecial,
  danger: styles.toneDanger,
  lapped: styles.toneLapped,
  neutral: styles.toneNeutral,
  muted: styles.toneMuted,
  licenseA: styles.toneLicenseA,
  licenseB: styles.toneLicenseB,
  licenseC: styles.toneLicenseC,
  licenseD: styles.toneLicenseD,
  licenseR: styles.toneLicenseR,
};

/**
 * How the chip draws itself — the one place a widget picks it, never its own
 * CSS:
 * - `reading` — a label and its value: the label light on a deep shade of the
 *   color, framed in it (the tables' bars, a lap time, a pit status);
 * - `state` — a label alone in the same deep shade, unframed (the session
 *   type, the lap a sector counts);
 * - `mark` — the label in its color on a dark ground of it, framed bright: a
 *   figure that stands out from its column (a best lap, the leader);
 * - `vivid` — the label filled in the full color: only where the color is the
 *   reading (a license class) or a call (PIT NOW);
 * - `plain` — the label in its color, an unlit frame.
 */
export type StatChipLook = 'plain' | 'reading' | 'state' | 'mark' | 'vivid';

const LOOK_CLASS: Record<StatChipLook, string> = {
  plain: '',
  reading: styles.lookReading,
  state: styles.lookState,
  mark: styles.lookMark,
  vivid: '',
};

/** The looks whose label is filled. */
const FILLED_LOOKS: ReadonlySet<StatChipLook> = new Set([
  'reading',
  'state',
  'vivid',
]);

/** The filled looks that drop their frame when the label is all they hold. */
const UNFRAMED_ALONE: ReadonlySet<StatChipLook> = new Set(['state', 'vivid']);

/** A word set as a label, or a number set in the mono face. */
export type StatChipLeadKind = 'label' | 'number';

/**
 * `md` for the session's own name over the table, a step up from every reading, so
 * the session reads first; `xs` for a note under a figure — the laps a fuel
 * reading lasts.
 */
export type StatChipSize = 'xs' | 'sm' | 'md';

const SIZE_CLASS: Record<StatChipSize, string> = {
  xs: styles.chipXs,
  sm: '',
  md: styles.chipMd,
};

/**
 * Turns a span written outside React — a gap cell that updates every tick —
 * into a chip that is its lead alone, built as the component builds one.
 */
export const writeStatChip = (
  element: HTMLElement,
  tone: StatChipTone,
  kind: StatChipLeadKind,
  text: string,
  look: StatChipLook = 'plain'
): void => {
  element.className = [
    styles.chip,
    styles.chipSingle,
    TONE_CLASS[tone],
    LOOK_CLASS[look],
    styles.lead,
    kind === 'label' ? styles.leadLabel : styles.leadNumber,
    FILLED_LOOKS.has(look) ? styles.leadSolid : '',
  ]
    .filter(Boolean)
    .join(' ');

  const textElement = document.createElement('span');
  textElement.className = styles.leadText;
  textElement.textContent = text;
  element.replaceChildren(textElement);
};

const ICON_SIZE_PX = 12;

interface StatChipProps {
  icon?: LucideIcon;
  /** The lead part: a label, a status, a rating. */
  lead?: ReactNode;
  leadKind?: StatChipLeadKind;
  look?: StatChipLook;
  size?: StatChipSize;
  /** The value part, on the chip's dark ground. */
  children?: ReactNode;
  /** The limit the value counts toward — "/17" after "15". */
  limit?: ReactNode;
  /**
   * The characters the value always holds, right-aligned — the widest its
   * format writes — so a column of chips keeps one width.
   */
  valueChars?: number;
  tone?: StatChipTone;
  /** A data-driven color (temperature, wetness); wins over `tone`. */
  toneColor?: string;
  /** The value in the danger color — a limit is close. */
  valueDanger?: boolean;
  className?: string;
}

/**
 * A reading as a lead in its color and a value on the chip's dark ground. A
 * rating, a pit badge and a header reading all take this shape, so a value
 * reads the same wherever it sits.
 */
export const StatChip = observer(
  ({
    icon: Icon,
    lead,
    leadKind = 'label',
    look = 'plain',
    size = 'sm',
    children,
    limit,
    valueChars,
    tone,
    toneColor,
    valueDanger = false,
    className,
  }: StatChipProps) => {
    const toneStyle =
      toneColor === undefined
        ? undefined
        : ({ '--chip-data': toneColor } as CSSProperties);

    const toneClass =
      toneColor !== undefined
        ? styles.toneData
        : tone === undefined
          ? ''
          : TONE_CLASS[tone];

    const hasLead = Icon !== undefined || lead !== undefined;
    const hasValue = children !== undefined;
    const isFilled = FILLED_LOOKS.has(look);

    return (
      <span
        className={[
          styles.chip,
          hasValue ? '' : styles.chipSingle,
          !hasValue && UNFRAMED_ALONE.has(look) ? styles.chipSolid : '',
          SIZE_CLASS[size],
          toneClass,
          LOOK_CLASS[look],
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={toneStyle}
      >
        {hasLead && (
          <span
            className={[
              styles.lead,
              leadKind === 'label' ? styles.leadLabel : styles.leadNumber,
              isFilled ? styles.leadSolid : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {Icon && <Icon size={ICON_SIZE_PX} className={styles.icon} />}
            {lead !== undefined && (
              <span className={styles.leadText}>{lead}</span>
            )}
          </span>
        )}

        {hasValue && (
          <span className={styles.value}>
            {/* Only the count turns red; its limit keeps the value's white. */}
            <span
              className={[
                valueDanger ? styles.valueDanger : '',
                valueChars === undefined ? '' : styles.valueFixed,
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                valueChars === undefined
                  ? undefined
                  : { minWidth: `${valueChars}ch` }
              }
            >
              {children}
            </span>
            {limit !== undefined && <>/{limit}</>}
          </span>
        )}
      </span>
    );
  }
);

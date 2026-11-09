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
 * `tint` writes the lead in its color on a dark ground of it; `solid` fills it
 * with the color — kept for what names a state: the session type, a license
 * class, a pit badge.
 */
export type StatChipLead = 'tint' | 'solid';

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
  text: string
): void => {
  element.className = [
    styles.chip,
    styles.chipSingle,
    TONE_CLASS[tone],
    styles.lead,
    kind === 'label' ? styles.leadLabel : styles.leadNumber,
  ].join(' ');

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
  leadVariant?: StatChipLead;
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
  /** The chip's state asks for a look: its edge takes the color. */
  emphasized?: boolean;
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
    leadVariant = 'tint',
    size = 'sm',
    children,
    limit,
    valueChars,
    tone,
    toneColor,
    emphasized = false,
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

    return (
      <span
        className={[
          styles.chip,
          hasValue ? '' : styles.chipSingle,
          !hasValue && leadVariant === 'solid' ? styles.chipSolid : '',
          SIZE_CLASS[size],
          toneClass,
          emphasized ? styles.chipEmphasized : '',
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
              leadVariant === 'solid' ? styles.leadSolid : '',
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

import { observer } from 'mobx-react-lite';

import styles from './FixedDigits.module.scss';

interface FixedDigitsProps {
  /** Any text; only its digits are laid out on the fixed grid. */
  text: string;
  className?: string;
}

const DIGIT_PATTERN = /\d/;

/**
 * Renders text with every digit in a cell of the same width, so a clock or a
 * lap count does not shuffle sideways as its digits change. `tabular-nums`
 * cannot do this here — Rajdhani ships no tabular figures, so the browser has
 * nothing to switch to and the widget's own font falls back to proportional
 * ones.
 */
export const FixedDigits = observer(({ text, className }: FixedDigitsProps) => (
  <span className={className}>
    {Array.from(text, (char, index) =>
      DIGIT_PATTERN.test(char) ? (
        <span className={styles.digit} key={index}>
          {char}
        </span>
      ) : (
        <span className={styles.separator} key={index}>
          {char}
        </span>
      )
    )}
  </span>
));

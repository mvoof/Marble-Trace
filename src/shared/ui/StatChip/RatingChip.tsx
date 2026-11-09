import { observer } from 'mobx-react-lite';

import type { LicBadgeStyle } from '@shared/contracts/widget-choices';
import {
  formatIr,
  iRatingChars,
  licenseTone,
  safetyRatingLabel,
  safetyRatingParts,
  type RatingChipSr,
} from './rating';
import { StatChip } from './StatChip';
import styles from './RatingChip.module.scss';

interface SafetyRatingChipProps {
  licString: string;
  /** What the chip shows of the license — never 'none'; the column is off then. */
  content: Exclude<RatingChipSr, 'none'>;
  badgeStyle: LicBadgeStyle;
}

/**
 * A driver's safety rating, a column of its own: the class letter, the rating,
 * or both. Filled, the letter sits on the license's bright color and the
 * rating on its deeper shade, so the class reads first.
 */
export const SafetyRatingChip = observer(
  ({ licString, content, badgeStyle }: SafetyRatingChipProps) => {
    const isSolid = badgeStyle !== 'dark';
    const parts = safetyRatingParts(licString);
    const showsLetter = content !== 'ratingOnly' || parts.rating === '';
    const showsRating = content !== 'letterOnly' && parts.rating !== '';
    const splitsLetter = isSolid && showsLetter;

    const solidLead = showsRating ? (
      <>
        <span className={styles.letter}>{parts.letter}</span>
        <span className={styles.rating}>{parts.rating}</span>
      </>
    ) : (
      <span className={`${styles.letter} ${styles.letterAlone}`}>
        {parts.letter}
      </span>
    );

    const lead = splitsLetter
      ? solidLead
      : showsRating
        ? safetyRatingLabel(licString, showsLetter)
        : parts.letter;

    return (
      <StatChip
        className={[
          isSolid ? styles.srSolid : '',
          splitsLetter ? styles.split : '',
        ].join(' ')}
        lead={lead}
        leadKind="number"
        look={isSolid ? 'vivid' : 'plain'}
        tone={licenseTone(licString)}
      />
    );
  }
);

interface IRatingChipProps {
  iRating: number;
  abbreviate: boolean;
  /** The white chip, or the number alone in the row's white. */
  hasBackground: boolean;
}

/** A driver's iRating, a column of its own: a white chip, its number dark. */
export const IRatingChip = observer(
  ({ iRating, abbreviate, hasBackground }: IRatingChipProps) => (
    <StatChip
      className={`${styles.iRating} ${hasBackground ? '' : styles.iRatingPlain}`}
      valueChars={iRatingChars(abbreviate)}
    >
      {formatIr(iRating, abbreviate)}
    </StatChip>
  )
);

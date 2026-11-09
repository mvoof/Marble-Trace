import { observer } from 'mobx-react-lite';

import type { LicBadgeStyle } from '@shared/contracts/widget-choices';
import {
  formatIr,
  iRatingChars,
  licenseTone,
  safetyRatingLabel,
  safetyRatingParts,
} from './rating';
import { StatChip } from './StatChip';
import styles from './RatingChip.module.scss';

interface SafetyRatingChipProps {
  licString: string;
  showLicenseLetter: boolean;
  badgeStyle: LicBadgeStyle;
}

/**
 * A driver's safety rating, a column of its own. Filled, the class letter sits
 * on the license's bright color and the rating on its deeper shade, so the
 * class reads first.
 */
export const SafetyRatingChip = observer(
  ({ licString, showLicenseLetter, badgeStyle }: SafetyRatingChipProps) => {
    const isSolid = badgeStyle !== 'dark';
    const parts = safetyRatingParts(licString);
    const splitsLetter = isSolid && showLicenseLetter && parts.rating !== '';

    const lead = splitsLetter ? (
      <>
        <span className={styles.letter}>{parts.letter}</span>
        <span className={styles.rating}>{parts.rating}</span>
      </>
    ) : (
      safetyRatingLabel(licString, showLicenseLetter)
    );

    return (
      <StatChip
        className={[
          isSolid ? styles.srSolid : '',
          splitsLetter ? styles.split : '',
        ].join(' ')}
        lead={lead}
        leadKind="number"
        leadVariant={isSolid ? 'solid' : 'tint'}
        tone={licenseTone(licString)}
      />
    );
  }
);

interface IRatingChipProps {
  iRating: number;
  abbreviate: boolean;
}

/** A driver's iRating, a column of its own: a white chip, its number dark. */
export const IRatingChip = observer(
  ({ iRating, abbreviate }: IRatingChipProps) => (
    <StatChip className={styles.iRating} valueChars={iRatingChars(abbreviate)}>
      {formatIr(iRating, abbreviate)}
    </StatChip>
  )
);

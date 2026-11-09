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

interface RatingChipProps {
  licString: string;
  iRating: number;
  showSafetyRating: boolean;
  showLicenseLetter: boolean;
  showIRating: boolean;
  abbreviateIRating: boolean;
  badgeStyle: LicBadgeStyle;
}

/**
 * A driver's safety rating and iRating as two chips side by side. Filled, the
 * SR chip puts the class letter on the license's bright color and the rating
 * on its deeper shade; the iRating is a chip of its own on the darkest ground.
 * The pair takes the width `ratingChipWidth` counts for one chip: the iRating
 * gives up the room its second edge and the gap take.
 */
export const RatingChip = observer(
  ({
    licString,
    iRating,
    showSafetyRating,
    showLicenseLetter,
    showIRating,
    abbreviateIRating,
    badgeStyle,
  }: RatingChipProps) => {
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
      <span className={`${styles.pair} ${isSolid ? styles.pairSolid : ''}`}>
        {showSafetyRating && (
          <StatChip
            className={splitsLetter ? styles.split : undefined}
            lead={lead}
            leadKind="number"
            leadVariant={isSolid ? 'solid' : 'tint'}
            tone={licenseTone(licString)}
          />
        )}

        {showIRating && (
          <StatChip
            className={styles.iRating}
            valueChars={iRatingChars(abbreviateIRating)}
          >
            {formatIr(iRating, abbreviateIRating)}
          </StatChip>
        )}
      </span>
    );
  }
);

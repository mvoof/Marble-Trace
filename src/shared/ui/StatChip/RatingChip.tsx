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
 * A driver's safety rating and iRating as one chip. Filled, the class letter
 * sits on the license's bright color and the rating on its deeper shade, so
 * the class reads first; the iRating follows on the chip's darkest ground.
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

    const lead = !showSafetyRating ? undefined : splitsLetter ? (
      <>
        <span className={styles.letter}>{parts.letter}</span>
        <span className={styles.rating}>{parts.rating}</span>
      </>
    ) : (
      safetyRatingLabel(licString, showLicenseLetter)
    );

    return (
      <StatChip
        className={
          showSafetyRating && splitsLetter
            ? `${styles.chip} ${styles.split}`
            : styles.chip
        }
        lead={lead}
        leadKind="number"
        leadVariant={isSolid ? 'solid' : 'tint'}
        tone={licenseTone(licString)}
        valueChars={iRatingChars(abbreviateIRating)}
      >
        {showIRating ? formatIr(iRating, abbreviateIRating) : undefined}
      </StatChip>
    );
  }
);

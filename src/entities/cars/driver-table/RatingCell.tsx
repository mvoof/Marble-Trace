import { observer } from 'mobx-react-lite';

import type { CarIdentity } from '@shared/contracts/car-identity';
import type { LicBadgeStyle } from '@shared/contracts/widget-choices';
import { IRatingChip, SafetyRatingChip } from '@shared/ui/StatChip/RatingChip';
import { ratingChipParts } from '@shared/ui/StatChip/rating';

export type RatingColumn = 'sr' | 'ir';

interface RatingCellProps {
  column: RatingColumn;
  driver: Pick<CarIdentity, 'licString' | 'iRating'>;
  settings: {
    showLicBadge: boolean;
    showLicenseLetter: boolean;
    showSafetyRatingValue: boolean;
    showIRating: boolean;
    abbreviateIRating: boolean;
    showIRatingChip: boolean;
    licBadgeStyle: LicBadgeStyle;
  };
  /** The cell's classes — the table's column cell and its rule. */
  className: string;
}

/**
 * The safety rating or the iRating column of a driver table — one cell, so a
 * table can put the two wherever its column order says.
 */
export const RatingCell = observer(
  ({ column, driver, settings, className }: RatingCellProps) => {
    if (column === 'ir') {
      return settings.showIRating ? (
        <div className={className}>
          <IRatingChip
            iRating={driver.iRating}
            abbreviate={settings.abbreviateIRating}
            hasBackground={settings.showIRatingChip}
          />
        </div>
      ) : null;
    }

    // What the SR chip shows; 'none' only with the column off.
    const srContent = ratingChipParts(settings).sr;

    return srContent === 'none' ? null : (
      <div className={className}>
        <SafetyRatingChip
          licString={driver.licString}
          content={srContent}
          badgeStyle={settings.licBadgeStyle}
        />
      </div>
    );
  }
);

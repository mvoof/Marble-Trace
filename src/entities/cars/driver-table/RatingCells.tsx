import { observer } from 'mobx-react-lite';

import type { CarIdentity } from '@shared/contracts/car-identity';
import type { LicBadgeStyle } from '@shared/contracts/widget-choices';
import { IRatingChip, SafetyRatingChip } from '@shared/ui/StatChip/RatingChip';
import { ratingChipParts } from '@shared/ui/StatChip/rating';

export type RatingColumn = 'sr' | 'ir';

interface RatingCellsProps {
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
  cellClassName: (column: RatingColumn) => string;
}

/** The safety rating and iRating columns of a driver table, each its own cell. */
export const RatingCells = observer(
  ({ driver, settings, cellClassName }: RatingCellsProps) => {
    // What the SR chip shows; 'none' only with the column off.
    const srContent = ratingChipParts(settings).sr;

    return (
      <>
        {srContent !== 'none' && (
          <div className={cellClassName('sr')}>
            <SafetyRatingChip
              licString={driver.licString}
              content={srContent}
              badgeStyle={settings.licBadgeStyle}
            />
          </div>
        )}

        {settings.showIRating && (
          <div className={cellClassName('ir')}>
            <IRatingChip
              iRating={driver.iRating}
              abbreviate={settings.abbreviateIRating}
              hasBackground={settings.showIRatingChip}
            />
          </div>
        )}
      </>
    );
  }
);

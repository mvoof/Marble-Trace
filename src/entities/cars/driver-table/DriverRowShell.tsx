import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import type { RowPadding } from '@shared/contracts/widget-choices';
import { playerRowStyle } from '@shared/lib/colors';
import { cx } from '@shared/lib/class-names';

import type { DriverRowState } from './driver-row-state';

/**
 * The classes a table widget styles its rows with — its own CSS module, built
 * from the mixins in `_driver-row.scss`, which define `driverRow`, `rowOdd`,
 * `driverRowPlayer`, `driverRowOffTrack`, `driverRowOut` and the
 * `rowPadding*` variants. Typed as a CSS module is, so the module passes as is.
 */
export type DriverRowClasses = Readonly<Record<string, string>>;

interface DriverRowShellProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'className' | 'style'
> {
  classes: DriverRowClasses;
  gridTemplate: string;
  classColor: string;
  rowPadding: RowPadding;
  isPlayer: boolean;
  isOdd: boolean;
  state: Pick<DriverRowState, 'isOut' | 'isOffTrack'>;
  playerRowColor: string;
  /** The widget's own row classes, beside the shared ones. */
  className?: string;
  children: ReactNode;
}

const PADDING_CLASS: Record<RowPadding, string> = {
  narrow: 'rowPaddingNarrow',
  medium: 'rowPaddingMedium',
  wide: 'rowPaddingWide',
};

/**
 * One row of a driver table: the grid, the class marker, odd and player
 * fills, and the off-track and out fade. Props only — the caller reads the
 * stores, so the cells it holds may come from any slice.
 */
export const DriverRowShell = observer(
  ({
    classes,
    gridTemplate,
    classColor,
    rowPadding,
    isPlayer,
    isOdd,
    state,
    playerRowColor,
    className,
    children,
    ...attributes
  }: DriverRowShellProps) => {
    // The stripe is painted by a pseudo-element, so the class color reaches
    // it through a variable — the same marker the class header carries.
    const rowStyle = {
      gridTemplateColumns: gridTemplate,
      ...playerRowStyle(isPlayer, playerRowColor),
      '--row-class-marker': classColor,
    } as CSSProperties;

    return (
      <div
        {...attributes}
        className={cx(
          classes.driverRow,
          classes[PADDING_CLASS[rowPadding]],
          isPlayer && classes.driverRowPlayer,
          isOdd && classes.rowOdd,
          state.isOffTrack && classes.driverRowOffTrack,
          state.isOut && classes.driverRowOut,
          className
        )}
        style={rowStyle}
      >
        {children}
      </div>
    );
  }
);

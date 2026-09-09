import { observer } from 'mobx-react-lite';
import { WidgetValue } from '@ui/shared/WidgetValue/WidgetValue';
import { EngineCell } from './EngineCell';
import { usePlayerStore } from '@store/root-store-context';
import styles from './EnginePanelWidget.module.scss';

export interface AbsCellProps {
  dividerRight?: boolean;
  dividerTop?: boolean;
}

// Separate from the root on purpose: the ABS light lives in the 60 Hz carInputs
// frame, and reading it in EnginePanelWidget would re-render every cell at
// physics rate. It is read through `isAbsActive`, which is the light itself
// rather than the frame carrying it, so a burst of inputs wakes nothing here.
export const AbsCell = observer(
  ({ dividerRight = false, dividerTop = false }: AbsCellProps) => {
    const { carStatus, isAbsActive } = usePlayerStore();

    const dcAbs = carStatus?.dc_abs ?? null;

    const formattedAbs = dcAbs !== null ? Math.round(dcAbs).toString() : '--';

    return (
      <EngineCell
        label="ABS"
        className={isAbsActive ? styles.absActive : ''}
        dividerRight={dividerRight}
        dividerTop={dividerTop}
      >
        <WidgetValue
          value={formattedAbs}
          className={`${styles.value} ${styles.yellowValue}`}
        />
      </EngineCell>
    );
  }
);

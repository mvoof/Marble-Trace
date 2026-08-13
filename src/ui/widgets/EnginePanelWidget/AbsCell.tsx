import { observer } from 'mobx-react-lite';
import { WidgetValue } from '@ui/shared/WidgetValue/WidgetValue';
import { EngineCell } from './EngineCell';
import { usePlayerStore } from '@store/root-store-context';
import styles from './EnginePanelWidget.module.scss';

export interface AbsCellProps {
  dividerRight?: boolean;
  dividerTop?: boolean;
}

// Separate from the root on purpose: `brake_abs_active` lives in the 60 Hz
// carInputs frame, and reading it in EnginePanelWidget would re-render every
// cell at physics rate.
export const AbsCell = observer(
  ({ dividerRight = false, dividerTop = false }: AbsCellProps) => {
    const { carStatus, carInputs } = usePlayerStore();

    const dcAbs = carStatus?.dc_abs ?? null;
    const absActive = carInputs?.brake_abs_active ?? false;

    const formattedAbs = dcAbs !== null ? Math.round(dcAbs).toString() : '--';

    return (
      <EngineCell
        label="ABS"
        className={absActive ? styles.absActive : ''}
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

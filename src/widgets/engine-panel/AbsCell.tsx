import { observer } from 'mobx-react-lite';
import { WidgetValue } from '@shared/ui/WidgetValue/WidgetValue';
import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { EngineCell } from './EngineCell';
import { usePlayerStore } from '@entities/player/player-context';
import { useEnginePanelWidgetStore } from '@widgets/engine-panel/engine-panel.store';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import styles from './EnginePanelWidget.module.scss';
import type { EnginePanelWidgetSettings } from './settings-schema';

export interface AbsCellProps {
  lead: boolean;
}

// Separate from the root on purpose: the ABS light lives in the 60 Hz carInputs
// frame, and reading it in EnginePanelWidget would re-render every cell at
// physics rate. It is read through `isAbsActive`, which is the light itself
// rather than the frame carrying it, so a burst of inputs wakes nothing here.
export const AbsCell = observer(({ lead }: AbsCellProps) => {
  const { carStatus, isAbsActive } = usePlayerStore();
  const enginePanel = useEnginePanelWidgetStore();
  const settings = useWidgetSettings<EnginePanelWidgetSettings>('engine-panel');

  const dcAbs = carStatus?.dc_abs ?? null;

  const formattedAbs = dcAbs !== null ? Math.round(dcAbs).toString() : '--';

  return (
    <EngineCell
      label="ABS"
      lead={lead}
      lit={
        settings.highlightChanges !== false && enginePanel.isChanged('dc_abs')
      }
      className={isAbsActive ? styles.absActive : ''}
    >
      <WidgetValue
        value={<FixedDigits text={formattedAbs} />}
        className={styles.value}
      />
    </EngineCell>
  );
});

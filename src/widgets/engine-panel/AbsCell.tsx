import { observer } from 'mobx-react-lite';
import { EngineCell } from './EngineCell';
import { AdjustmentChip } from './AdjustmentChip';
import { usePlayerStore } from '@entities/player/player-context';
import { useEnginePanelWidgetStore } from '@widgets/engine-panel/engine-panel.store';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import styles from './EnginePanelWidget.module.scss';
import type { EnginePanelWidgetSettings } from './settings-schema';

// Separate from the root on purpose: the ABS light lives in the 60 Hz carInputs
// frame, and reading it in EnginePanelWidget would re-render every cell at
// physics rate. It is read through `isAbsActive`, which is the light itself
// rather than the frame carrying it, so a burst of inputs wakes nothing here.
export const AbsCell = observer(() => {
  const { carStatus, isAbsActive } = usePlayerStore();
  const enginePanel = useEnginePanelWidgetStore();
  const settings = useWidgetSettings<EnginePanelWidgetSettings>('engine-panel');

  const dcAbs = carStatus?.dc_abs ?? null;

  const formattedAbs = dcAbs !== null ? Math.round(dcAbs).toString() : '--';

  return (
    <EngineCell
      label="ABS"
      lit={
        settings.highlightChanges !== false && enginePanel.isChanged('dc_abs')
      }
      className={isAbsActive ? styles.absActive : ''}
    >
      {/* Working, the figure takes the tone's own color, framed bright. */}
      <AdjustmentChip
        text={formattedAbs}
        tone="accent"
        look={isAbsActive ? 'mark' : 'reading'}
      />
    </EngineCell>
  );
});

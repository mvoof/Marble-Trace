import { observer } from 'mobx-react-lite';

import { CurrentLapRow } from './CurrentLapRow/CurrentLapRow';
import { PredictedRow } from './PredictedRow/PredictedRow';
import { LastLapRow } from './LastLapRow/LastLapRow';
import { BestLapRow } from './BestLapRow/BestLapRow';
import { P1Row } from './P1Row/P1Row';

import styles from './LapTimesContent.module.scss';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const LapTimesContent = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const isHorizontal =
    widgetSettings.getLapTimesSettings().layout === 'horizontal';

  return (
    <div
      className={
        isHorizontal ? styles.rowListHorizontal : styles.rowListVertical
      }
    >
      <CurrentLapRow />
      <PredictedRow />
      <LastLapRow />
      <BestLapRow />
      <P1Row />
    </div>
  );
});

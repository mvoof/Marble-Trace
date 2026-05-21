import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '@store/widget-settings.store';
import { CurrentLapRow } from './CurrentLapRow/CurrentLapRow';
import { PredictedRow } from './PredictedRow/PredictedRow';
import { LastLapRow } from './LastLapRow/LastLapRow';
import { BestLapRow } from './BestLapRow/BestLapRow';
import { P1Row } from './P1Row/P1Row';

import styles from './LapTimesContent.module.scss';

export const LapTimesContent = observer(() => {
  const isHorizontal =
    widgetSettingsStore.getLapTimesSettings().layout === 'horizontal';

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

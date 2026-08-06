import { observer } from 'mobx-react-lite';

import { TireCorner } from './TireCorner/TireCorner';
import { AutoMark } from '@widgets/PitServiceWidget/AutoMark/AutoMark';
import styles from './TireGrid.module.scss';
import { usePitServiceWidgetStore } from '@store/root-store-context';

export const TireGrid = observer(() => {
  const pitService = usePitServiceWidgetStore();

  return (
    <div className={styles.block}>
      {/*
        Sits on its own line only when auto tires are on; the grid keeps the
        full width otherwise.
      */}
      {pitService.isAutoTiresEnabled && (
        <div className={styles.header}>
          <span className={styles.label}>TIRES</span>

          <AutoMark enabled />
        </div>
      )}

      <div className={styles.grid}>
        <TireCorner position="lf" />

        <TireCorner position="rf" />

        <TireCorner position="lr" />

        <TireCorner position="rr" />
      </div>
    </div>
  );
});

import { observer } from 'mobx-react-lite';

import { TireCorner } from './TireCorner/TireCorner';
import styles from './TireGrid.module.scss';
import { CompoundRow } from '../CompoundRow/CompoundRow';
import { usePitServiceWidgetStore } from '@store/root-store-context';

export const TireGrid = observer(() => {
  const pitService = usePitServiceWidgetStore();

  return (
    <div className={styles.block}>
      {/*
        Sits on its own line only when auto tires are on; the grid keeps the
        full width otherwise. Which half auto mode still owns is said once, on
        the header plate, rather than repeated over every block.
      */}
      {pitService.auto.isAutoTiresEnabled && (
        <div className={styles.header}>
          <span className={styles.label}>TIRES</span>
        </div>
      )}

      <div className={styles.grid}>
        <TireCorner position="lf" />

        <TireCorner position="rf" />

        <TireCorner position="lr" />

        <TireCorner position="rr" />
      </div>

      <CompoundRow />
    </div>
  );
});

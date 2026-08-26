import { observer } from 'mobx-react-lite';

import { TireCorner } from './TireCorner/TireCorner';
import styles from './TireGrid.module.scss';

export const TireGrid = observer(() => (
  <div className={styles.grid}>
    <TireCorner position="lf" />

    <TireCorner position="rf" />

    <TireCorner position="lr" />

    <TireCorner position="rr" />
  </div>
));

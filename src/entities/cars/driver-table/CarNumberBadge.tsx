import { observer } from 'mobx-react-lite';

import { getContrastTextColor } from '@shared/lib/colors';
import { formatCarNumber } from '@shared/lib/driver';

import styles from './CarNumberBadge.module.scss';

interface CarNumberBadgeProps {
  carNumber: string;
  classColor: string;
}

/** The car's number on its class color, one box for one to three digits. */
export const CarNumberBadge = observer(
  ({ carNumber, classColor }: CarNumberBadgeProps) => (
    <span
      className={styles.carNumber}
      style={{
        backgroundColor: classColor,
        color: getContrastTextColor(classColor),
      }}
    >
      {formatCarNumber(carNumber)}
    </span>
  )
);

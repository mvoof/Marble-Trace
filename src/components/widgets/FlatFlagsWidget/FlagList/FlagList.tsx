import { observer } from 'mobx-react-lite';

import type { FlagType } from '../../../../types';
import { FlagItem } from '../FlagItem/FlagItem';

import styles from './FlagList.module.scss';

interface FlagListProps {
  displayFlags: FlagType[];
  blinkOn: boolean;
}

export const FlagList = observer(({ displayFlags, blinkOn }: FlagListProps) => (
  <div className={styles.list}>
    {displayFlags.length === 0 ? (
      <div className={styles.empty}>NO ACTIVE FLAGS</div>
    ) : (
      displayFlags.map((flag) => (
        <FlagItem key={flag} flag={flag} blinkOn={blinkOn} />
      ))
    )}
  </div>
));

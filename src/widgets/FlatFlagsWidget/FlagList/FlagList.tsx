import { observer } from 'mobx-react-lite';

import { flagsStore } from '@store/flags.store';
import { FlagItem } from '@widgets/FlatFlagsWidget/FlagItem/FlagItem';

import styles from './FlagList.module.scss';

interface FlagListProps {
  blinkOn: boolean;
}

export const FlagList = observer(({ blinkOn }: FlagListProps) => (
  <div className={styles.list}>
    {flagsStore.displayFlags.length === 0 ? (
      <div className={styles.empty}>NO ACTIVE FLAGS</div>
    ) : (
      flagsStore.displayFlags.map((flag) => (
        <FlagItem key={flag} flag={flag} blinkOn={blinkOn} />
      ))
    )}
  </div>
));

import { observer } from 'mobx-react-lite';

import { FlagItem } from '@widgets/FlatFlagsWidget/FlagItem/FlagItem';

import styles from './FlagList.module.scss';
import { useFlagsStore } from '@store/root-store-context';

export const FlagList = observer(() => {
  const { displayFlags } = useFlagsStore();

  return (
    <div className={styles.list}>
      {displayFlags.length === 0 ? (
        <div className={styles.empty}>NO ACTIVE FLAGS</div>
      ) : (
        displayFlags.map((flag) => <FlagItem key={flag} flag={flag} />)
      )}
    </div>
  );
});

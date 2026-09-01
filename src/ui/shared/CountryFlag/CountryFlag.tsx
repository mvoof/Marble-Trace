import { observer } from 'mobx-react-lite';
import { Bot } from 'lucide-react';

import { countryCodeForFlairId } from '@utils/driver-flair';

import styles from './CountryFlag.module.scss';

interface CountryFlagProps {
  flairId: number | null | undefined;
  isAi?: boolean;
}

/**
 * The driver's profile country flag. AI entries carry no flair at all — the sim
 * omits the field in offline sessions — so they get a robot instead, which says
 * what the empty cell otherwise leaves the reader to guess. A human without a
 * flag stays blank: a placeholder there would read as data that is not there.
 */
export const CountryFlag = observer(({ flairId, isAi }: CountryFlagProps) => {
  const countryCode = countryCodeForFlairId(flairId);

  if (countryCode === null) {
    if (isAi) {
      return <Bot className={styles.aiIcon} />;
    }

    return <span className={styles.flagPlaceholder} />;
  }

  return <span className={`fi fi-${countryCode} ${styles.flag}`} />;
});

import { observer } from 'mobx-react-lite';

import { countryCodeForFlairId } from '@utils/driver-flair';

import styles from './CountryFlag.module.scss';

interface CountryFlagProps {
  flairId: number | null | undefined;
}

/**
 * The driver's profile country flag. Renders an empty cell rather than a
 * placeholder when the driver picked none — a table of fallback icons reads as
 * data that is not there.
 */
export const CountryFlag = observer(({ flairId }: CountryFlagProps) => {
  const countryCode = countryCodeForFlairId(flairId);

  if (countryCode === null) {
    return <span className={styles.flagPlaceholder} />;
  }

  return <span className={`fi fi-${countryCode} ${styles.flag}`} />;
});

import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { FileWarning } from 'lucide-react';

import { useSimStore } from '@entities/sim/sim-context';
import { useStatisticsStore } from '@features/statistics/statistics-context';
import styles from './AutologHint.module.scss';

const ICON_SIZE = 18;

/**
 * Shown while the game writes no telemetry files: without them there is
 * nothing to read. The game rewrites its settings when it closes, so the
 * switch waits for it to be closed.
 */
export const AutologHint = observer(() => {
  const { t } = useTranslation('main-app');
  const statistics = useStatisticsStore();
  const sim = useSimStore();

  if (statistics.autolog !== 'off') {
    return null;
  }

  const isGameRunning = sim.status === 'connected';

  const handleEnable = () => void statistics.enableAutolog();

  return (
    <div className={styles.hint}>
      <FileWarning size={ICON_SIZE} className={styles.icon} />

      <div className={styles.body}>
        <p className={styles.title}>{t('homePage.autolog.title')}</p>

        <p className={styles.text}>{t('homePage.autolog.text')}</p>

        {statistics.autologError !== null && (
          <p className={styles.error}>
            {t('homePage.autolog.failed', {
              reason: statistics.autologError,
            })}
          </p>
        )}
      </div>

      <div className={styles.action}>
        <Button
          onClick={handleEnable}
          loading={statistics.enablingAutolog}
          disabled={isGameRunning}
        >
          {t('homePage.autolog.enable')}
        </Button>

        {isGameRunning && (
          <span className={styles.note}>{t('homePage.autolog.closeGame')}</span>
        )}
      </div>
    </div>
  );
});

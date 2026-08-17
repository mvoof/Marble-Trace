import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Progress } from 'antd';
import { useFpsDiagnosticsStore } from '@store/root-store-context';
import styles from './FpsDiagnosticsCard.module.scss';

export const DiagnosticsProgress = observer(() => {
  const diagnostics = useFpsDiagnosticsStore();
  const { t } = useTranslation('main-app');

  if (!diagnostics.isRunning) {
    return null;
  }

  const percent =
    diagnostics.totalSteps === 0
      ? 0
      : Math.round((diagnostics.completedSteps / diagnostics.totalSteps) * 100);

  return (
    <div className={styles.progress}>
      <div className={styles.phaseLine}>
        <span className={styles.phaseLabel}>
          {t(`settingsPage.fpsDiagnostics.phase.${diagnostics.phase}`)}
        </span>

        <span className={styles.countdown}>{diagnostics.secondsLeft}</span>
      </div>

      {diagnostics.phase === 'countdown' && (
        <div className={styles.hint}>
          {t('settingsPage.fpsDiagnostics.switchToSim')}
        </div>
      )}

      <Progress percent={percent} size="small" />
    </div>
  );
});

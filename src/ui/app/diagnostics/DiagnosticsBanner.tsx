import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useDiagnosticsHudStore } from '@store/root-store-context';
import styles from './DiagnosticsHudWindow.module.scss';

const PERCENT = 100;

export const DiagnosticsBanner = observer(() => {
  const hud = useDiagnosticsHudStore();
  const { t } = useTranslation('main-app');
  const state = hud.state;

  if (!state) {
    return null;
  }

  const percent =
    state.totalSteps === 0
      ? 0
      : Math.round((state.completedSteps / state.totalSteps) * PERCENT);

  const isFinished = state.phase === 'done' || state.phase === 'failed';

  const summaryLine = () => {
    if (state.phase === 'failed') {
      return state.error === null
        ? t('settingsPage.fpsDiagnostics.phase.failed')
        : t(`settingsPage.fpsDiagnostics.error.${state.error}`);
    }

    if (state.summaryDeltaFps === null) {
      return t('settingsPage.fpsDiagnostics.hud.doneNoSummary');
    }

    return t('settingsPage.fpsDiagnostics.hud.doneSummary', {
      delta: state.summaryDeltaFps.toFixed(1),
    });
  };

  return (
    <div className={styles.banner}>
      <div className={styles.headline}>
        <span className={styles.phase}>
          {t(`settingsPage.fpsDiagnostics.phase.${state.phase}`)}
        </span>

        {!isFinished && (
          <span className={styles.counter}>{state.secondsLeft}</span>
        )}
      </div>

      {isFinished ? (
        <div className={styles.summary}>{summaryLine()}</div>
      ) : (
        <>
          <div className={styles.detail}>
            {t('settingsPage.fpsDiagnostics.hud.progress', {
              done: state.completedSteps,
              total: state.totalSteps,
            })}
          </div>

          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${percent}%` }} />
          </div>
        </>
      )}
    </div>
  );
});

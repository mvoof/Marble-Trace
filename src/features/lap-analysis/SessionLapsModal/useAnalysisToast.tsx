import { useTranslation } from 'react-i18next';
import { App } from 'antd';

import type { LapAnalysisStore } from '../lap-analysis.store';
import styles from './SessionLapsModal.module.scss';

const MS_PER_SECOND = 1000;
const DASH = '—';
/** Long enough to reach the toast's link. */
const TOAST_SECONDS = 6;

/** After an add: "Analysis: Spa, 14 Nov — 3 laps · Open analysis". */
export const useAnalysisToast = (
  analysis: LapAnalysisStore,
  onOpenAnalysis: (() => void) | undefined
) => {
  const { t, i18n } = useTranslation('main-app');
  const { message } = App.useApp();

  return () => {
    const session = analysis.set.session;

    if (session === null) {
      return;
    }

    const date = new Intl.DateTimeFormat(i18n.language, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(session.startedAt * MS_PER_SECOND));
    const handleOpen = () => {
      message.destroy();
      analysis.closeSession();
      onOpenAnalysis?.();
    };

    void message.open({
      type: 'success',
      duration: TOAST_SECONDS,
      content: (
        <span className={styles.toast}>
          {t('homePage.sessionLaps.added', {
            track: session.trackName ?? DASH,
            date,
            count: analysis.laps.length,
          })}

          {onOpenAnalysis !== undefined && (
            <button
              type="button"
              className={styles.toastLink}
              onClick={handleOpen}
            >
              {t('homePage.sessionLaps.openAnalysis')}
            </button>
          )}
        </span>
      ),
    });
  };
};

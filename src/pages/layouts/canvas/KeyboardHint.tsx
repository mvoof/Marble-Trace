import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
  SquareArrowDown,
  SquareArrowLeft,
  SquareArrowRight,
  SquareArrowUp,
} from 'lucide-react';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { largeGridStepPx } from '@features/layout-editor/keyboard-nudge';

import styles from './KeyboardHint.module.scss';

/** The keys that act on the selected widget, under the canvas. */
export const KeyboardHint = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');
  const largeStep = largeGridStepPx({
    snap: appSettings.appSettings.editorSnapToGrid,
    size: appSettings.appSettings.editorGridSize,
  });

  return (
    <div className={styles.keyboardHint}>
      <div className={styles.arrowCluster}>
        <SquareArrowUp size={16} className={styles.arrowKey} />
        <div className={styles.arrowRow}>
          <SquareArrowLeft size={16} className={styles.arrowKey} />
          <SquareArrowDown size={16} className={styles.arrowKey} />
          <SquareArrowRight size={16} className={styles.arrowKey} />
        </div>
      </div>
      <span className={styles.keyboardHintLabel}>{t('layoutCanvas.move')}</span>
      <span className={styles.keyboardHintSep}>·</span>
      <kbd className={styles.kbd}>Shift</kbd>
      <span className={styles.keyboardHintLabel}>
        {t('layoutCanvas.stepSize', {
          size: largeStep !== null ? `${largeStep}px` : t('layoutCanvas.large'),
        })}
      </span>
      <span className={styles.keyboardHintSep}>·</span>
      <kbd className={styles.kbd}>Del</kbd>
      <span className={styles.keyboardHintLabel}>
        {t('layoutCanvas.remove')}
      </span>
    </div>
  );
});

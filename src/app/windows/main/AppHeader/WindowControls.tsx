import { useState, useEffect } from 'react';
import type { MouseEvent } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import styles from './WindowControls.module.scss';

const CONTROL_ICON_SIZE = 16;
const MAXIMISE_ICON_SIZE = 14;

const handleMinimize = (event: MouseEvent) => {
  event.stopPropagation();
  void getCurrentWindow().minimize();
};

const handleMaximize = (event: MouseEvent) => {
  event.stopPropagation();
  void getCurrentWindow().toggleMaximize();
};

const handleClose = (event: MouseEvent) => {
  event.stopPropagation();
  void getCurrentWindow().close();
};

// Minimize / maximize / close buttons. Lives in the unified header bar (which
// doubles as the window title bar).
export const WindowControls = observer(() => {
  const { t } = useTranslation('main-app');
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      setIsMaximized(await getCurrentWindow().isMaximized());
    };

    void checkMaximized();

    const unlisten = getCurrentWindow().onResized(() => {
      void checkMaximized();
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div
      className={styles.controls}
      onMouseDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <button
        type="button"
        className={styles.button}
        onClick={handleMinimize}
        aria-label={t('appHeader.window.minimise')}
        title={t('appHeader.window.minimise')}
      >
        <Minus size={CONTROL_ICON_SIZE} />
      </button>

      <button
        type="button"
        className={styles.button}
        onClick={handleMaximize}
        aria-label={t('appHeader.window.maximise')}
        title={t('appHeader.window.maximise')}
      >
        {isMaximized ? (
          <Copy size={MAXIMISE_ICON_SIZE} />
        ) : (
          <Square size={MAXIMISE_ICON_SIZE} />
        )}
      </button>

      <button
        type="button"
        className={`${styles.button} ${styles.close}`}
        onClick={handleClose}
        aria-label={t('appHeader.window.close')}
        title={t('appHeader.window.close')}
      >
        <X size={CONTROL_ICON_SIZE} />
      </button>
    </div>
  );
});

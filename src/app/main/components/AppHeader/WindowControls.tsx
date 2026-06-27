import { useState, useEffect } from 'react';
import type { MouseEvent } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import styles from './WindowControls.module.scss';

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
export const WindowControls = () => {
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
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.button}
        onClick={handleMinimize}
        aria-label="Minimize"
      >
        <Minus size={14} strokeWidth={2.5} />
      </button>

      <button
        type="button"
        className={styles.button}
        onClick={handleMaximize}
        aria-label="Maximize"
      >
        {isMaximized ? (
          <Copy size={12} strokeWidth={2.5} />
        ) : (
          <Square size={12} strokeWidth={2.5} />
        )}
      </button>

      <button
        type="button"
        className={`${styles.button} ${styles.close}`}
        onClick={handleClose}
        aria-label="Close"
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
};

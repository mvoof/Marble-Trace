import React, { useState, useEffect } from 'react';
import { Button } from 'antd';
import { Minus, Square, Copy, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import styles from './TitleBar.module.scss';
import Logo from '../../../../assets/logo.svg?react';

export const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await getCurrentWindow().isMaximized();
      setIsMaximized(maximized);
    };

    void checkMaximized();

    const unlisten = getCurrentWindow().onResized(() => {
      void checkMaximized();
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    void getCurrentWindow().minimize();
  };

  const handleMaximize = (e: React.MouseEvent) => {
    e.stopPropagation();
    void getCurrentWindow().toggleMaximize();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    void getCurrentWindow().close();
  };

  return (
    <div className={styles.titleBar}>
      <div className={styles.dragRegion} data-tauri-drag-region />
      <div className={styles.titleBarLeft}>
        <Logo className={styles.smallLogo} />
      </div>
      <div className={styles.titleBarRight}>
        <Button
          type="text"
          className={styles.controlButton}
          onClick={handleMinimize}
          icon={<Minus size={14} strokeWidth={2.5} />}
        />
        <Button
          type="text"
          className={styles.controlButton}
          onClick={handleMaximize}
          icon={
            isMaximized ? (
              <Copy size={12} strokeWidth={2.5} />
            ) : (
              <Square size={12} strokeWidth={2.5} />
            )
          }
        />
        <Button
          type="text"
          className={`${styles.controlButton} ${styles.close}`}
          onClick={handleClose}
          icon={<X size={14} strokeWidth={2.5} />}
        />
      </div>
    </div>
  );
};

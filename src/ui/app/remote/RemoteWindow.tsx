import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';

import { RemoteCanvas } from './RemoteCanvas';
import { RemoteStatusOverlay } from './RemoteStatusOverlay';
import styles from './RemoteWindow.module.scss';
import { useRemoteScreenStore } from '@store/remote/remote-screen-context';

/**
 * Shell of a remote screen: the browser-side counterpart of `OverlayWindow`.
 *
 * It owns exactly one browser concern — how much room the page actually has.
 * `visualViewport` rather than `innerHeight`: on a phone the address bar takes
 * a slice of the screen and hands it back on scroll, and a layout sized to the
 * wrong number is either clipped or floating in a gap.
 */
export const RemoteWindow = observer(() => {
  const screen = useRemoteScreenStore();

  useEffect(() => {
    const measure = () => {
      const viewport = window.visualViewport;

      screen.setViewport(
        Math.round(viewport?.width ?? window.innerWidth),
        Math.round(viewport?.height ?? window.innerHeight)
      );
    };

    measure();

    const viewport = window.visualViewport;

    viewport?.addEventListener('resize', measure);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);

    return () => {
      viewport?.removeEventListener('resize', measure);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [screen]);

  return (
    <div className={screen.isStream ? styles.windowStream : styles.window}>
      {screen.isReady && <RemoteCanvas />}

      <RemoteStatusOverlay />
    </div>
  );
});

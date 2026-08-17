import { observer } from 'mobx-react-lite';
import { Loader2, ShieldAlert, WifiOff } from 'lucide-react';

import styles from './RemoteStatusOverlay.module.scss';
import { useRemoteScreenStore } from '@store/remote/remote-screen-context';

const ICON_SIZE = 28;

/**
 * The only chrome a remote screen has. A tablet on the wheel is looked at, not
 * read, so this says what is wrong in one line and gets out of the way the
 * moment widgets can be drawn.
 */
export const RemoteStatusOverlay = observer(() => {
  const screen = useRemoteScreenStore();

  if (screen.connection === 'unauthorized') {
    return (
      <div className={styles.overlay}>
        <ShieldAlert size={ICON_SIZE} className={styles.iconError} />
        <span className={styles.title}>Access denied</span>
        <span className={styles.hint}>
          This link is missing its access token, or the token has changed. Open
          the screen again from the app settings.
        </span>
      </div>
    );
  }

  if (screen.connection === 'reconnecting') {
    return (
      <div className={styles.overlayCorner}>
        <WifiOff size={16} className={styles.iconMuted} />
        <span className={styles.hint}>Reconnecting…</span>
      </div>
    );
  }

  // Connected but nothing to draw yet: the app has not published this screen,
  // usually because the layout has no widgets on it.
  if (!screen.isReady) {
    return (
      <div className={styles.overlay}>
        <Loader2 size={ICON_SIZE} className={styles.iconSpinner} />
        <span className={styles.title}>Waiting for “{screen.slug}”</span>
        <span className={styles.hint}>
          Add widgets to this remote screen in the layout editor.
        </span>
      </div>
    );
  }

  return null;
});

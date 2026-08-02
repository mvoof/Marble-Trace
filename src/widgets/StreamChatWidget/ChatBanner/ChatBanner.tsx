import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { useStreamChatWidgetStore } from '@store/root-store-context';

import styles from './ChatBanner.module.scss';

/**
 * One line explaining why the feed is not behaving normally. Silence with no
 * explanation is the worst state a chat widget can be in — the user cannot
 * tell a quiet channel from a broken connection.
 */
export const ChatBanner = observer(() => {
  const chatWidget = useStreamChatWidgetStore();
  const { t } = useTranslation('widgets');

  const presence = chatWidget.banner;

  if (!presence) {
    return null;
  }

  if (presence.status === 'error') {
    return (
      <div className={`${styles.banner} ${styles.bannerError}`}>
        {presence.detail ?? t('streamChat.connectionFailed')}
      </div>
    );
  }

  if (presence.status === 'reconnecting') {
    return (
      <div className={`${styles.banner} ${styles.bannerWarn}`}>
        {t('streamChat.reconnecting', { attempt: presence.retry ?? 1 })}
      </div>
    );
  }

  if (presence.status === 'connecting') {
    return (
      <div className={`${styles.banner} ${styles.bannerWarn}`}>
        {t('streamChat.connecting')}
      </div>
    );
  }

  if (presence.roomMode) {
    return (
      <div className={`${styles.banner} ${styles.bannerInfo}`}>
        {presence.roomMode}
      </div>
    );
  }

  return null;
});

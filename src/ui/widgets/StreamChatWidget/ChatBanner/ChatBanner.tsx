import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { useStreamChatWidgetStore } from '@store/root-store-context';

import styles from './ChatBanner.module.scss';

/**
 * One thin line explaining why the feed is not behaving normally. Silence with
 * no explanation is the worst state a chat widget can be in — the user cannot
 * tell a quiet channel from a broken connection. It stays a strip rather than a
 * block: the feed below is what the user is here for.
 */
export const ChatBanner = observer(() => {
  const chatWidget = useStreamChatWidgetStore();
  const { t } = useTranslation('widgets');

  const presence = chatWidget.banner;

  if (!presence) {
    return null;
  }

  // Every state renders the same strip — a tone class and one centred label —
  // so the widget never changes height when the connection state flips.
  const tone = () => {
    if (presence.status === 'error') {
      return {
        toneClass: styles.bannerError,
        label: presence.detail ?? t('streamChat.connectionFailed'),
      };
    }

    if (presence.status === 'reconnecting') {
      return {
        toneClass: styles.bannerWarn,
        label: t('streamChat.reconnecting', { attempt: presence.retry ?? 1 }),
      };
    }

    if (presence.status === 'connecting') {
      return {
        toneClass: styles.bannerWarn,
        label: t('streamChat.connecting'),
      };
    }

    if (presence.roomMode) {
      return {
        toneClass: styles.bannerInfo,
        label:
          presence.roomMode.kind === 'slow'
            ? t('streamChat.roomMode.slow', {
                seconds: presence.roomMode.seconds,
              })
            : t(`streamChat.roomMode.${presence.roomMode.kind}`),
      };
    }

    return null;
  };

  const banner = tone();

  if (!banner) {
    return null;
  }

  return (
    <div className={`${styles.banner} ${banner.toneClass}`}>
      <span className={styles.label}>{banner.label}</span>
    </div>
  );
});

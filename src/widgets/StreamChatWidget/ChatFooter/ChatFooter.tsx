import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';

import type { ChatPresence } from '@/types/bindings';
import type { StreamChatWidgetSettings } from '@/types/widget-settings';
import {
  useStreamChatWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { PlatformGlyph } from '../PlatformGlyph/PlatformGlyph';

import styles from './ChatFooter.module.scss';

const STATUS_CLASS: Record<ChatPresence['status'], string> = {
  live: styles.dotLive,
  connecting: styles.dotWarn,
  reconnecting: styles.dotWarn,
  offline: styles.dotOff,
  error: styles.dotError,
};

const formatCount = (value: number, locale: string) =>
  value.toLocaleString(locale);

export const ChatFooter = observer(() => {
  const chatWidget = useStreamChatWidgetStore();
  const widgetSettings = useWidgetSettingsStore();
  const { t, i18n } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<StreamChatWidgetSettings>('stream-chat');
  const total = chatWidget.totalViewers;

  return (
    <div className={styles.footer}>
      {chatWidget.presenceList.map((presence) => (
        <span key={presence.platform} className={styles.count}>
          <span
            className={`${styles.dot} ${STATUS_CLASS[presence.status]}`}
            title={presence.status}
          />
          <PlatformGlyph
            platform={presence.platform}
            className={styles.footerGlyph}
          />
          {/* A platform that never reports viewers shows a dash rather than a
              zero — zero would read as "nobody is watching". */}
          <span className={presence.viewers === null ? styles.countStale : ''}>
            {presence.viewers === null
              ? '—'
              : formatCount(presence.viewers, i18n.language)}
          </span>
        </span>
      ))}

      {settings.showActivity && (
        <span className={styles.rate}>
          <Activity className={styles.rateIcon} />
          {chatWidget.messagesPerMinute}
          <span className={styles.rateUnit}>{t('streamChat.perMinute')}</span>
        </span>
      )}

      {total !== null && (
        <span className={styles.total}>
          <span className={styles.totalLabel}>{t('streamChat.total')}</span>
          {formatCount(total, i18n.language)}
        </span>
      )}
    </div>
  );
});

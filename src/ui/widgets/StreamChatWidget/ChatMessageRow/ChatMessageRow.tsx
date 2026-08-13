import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import type { ChatMessage } from '@/types/bindings';
import type { StreamChatWidgetSettings } from '@/types/widget-settings';
import { useWidgetSettingsStore } from '@store/root-store-context';
import { PlatformGlyph } from '../PlatformGlyph/PlatformGlyph';

import styles from './ChatMessageRow.module.scss';

interface ChatMessageRowProps {
  message: ChatMessage;
}

const BADGE_CLASS: Record<string, string> = {
  moderator: styles.badgeMod,
  broadcaster: styles.badgeHost,
  subscriber: styles.badgeSub,
  vip: styles.badgeVip,
};

export const ChatMessageRow = observer(({ message }: ChatMessageRowProps) => {
  const widgetSettings = useWidgetSettingsStore();
  const { t } = useTranslation('widgets');
  const settings =
    widgetSettings.getSettings<StreamChatWidgetSettings>('stream-chat');

  const stripeClass =
    message.platform === 'twitch' ? styles.stripeTwitch : styles.stripeYoutube;

  const highlight = message.highlight;
  const isEvent =
    highlight !== null &&
    (highlight.kind === 'subscription' || highlight.kind === 'raid');

  const rowClass = [
    styles.row,
    settings.compactRows ? styles.rowCompact : '',
    isEvent ? styles.rowHighlight : '',
    highlight?.kind === 'paid' ? styles.rowPaid : '',
    highlight?.kind === 'firstMessage' ? styles.rowFirst : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowClass}>
      <span className={`${styles.stripe} ${stripeClass}`} />

      <span className={styles.content}>
        {isEvent ? (
          <span className={styles.event}>
            <PlatformGlyph platform={message.platform} />
            {highlight.text}
          </span>
        ) : (
          <>
            <span className={styles.meta}>
              {settings.showPlatformGlyph && (
                <PlatformGlyph
                  platform={message.platform}
                  className={styles.metaGlyph}
                />
              )}

              {settings.showBadges &&
                message.badges.map((badge) =>
                  // Artwork when it resolved and the user asked for it;
                  // the text plate is always the fallback.
                  settings.badgeImages && badge.url !== null ? (
                    <img
                      key={`${badge.kind}-${badge.label}`}
                      className={styles.badgeImage}
                      src={badge.url}
                      alt={badge.label}
                      title={badge.label}
                      loading="lazy"
                    />
                  ) : (
                    <span
                      key={`${badge.kind}-${badge.label}`}
                      className={[styles.badge, BADGE_CLASS[badge.kind]]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {badge.label}
                    </span>
                  )
                )}

              <span
                className={styles.nick}
                style={{ color: message.authorColor }}
              >
                {message.authorName}
              </span>

              {/* Super Chat arrives pre-formatted with its currency; a Twitch
                  cheer is a bare count, so the unit is translated here. */}
              {highlight?.amount && (
                <span className={styles.amount}>{highlight.amount}</span>
              )}

              {highlight?.bits != null && (
                <span className={styles.amount}>
                  {t('streamChat.bits', { count: highlight.bits })}
                </span>
              )}
            </span>

            <span className={styles.body}>
              {message.fragments.map((fragment, index) =>
                fragment.kind === 'text' ? (
                  // Fragments have no ids of their own; the index is stable
                  // because a message never changes after it arrives.
                  <span key={index}>{fragment.text}</span>
                ) : (
                  <img
                    key={index}
                    className={styles.emote}
                    src={fragment.url}
                    alt={fragment.name}
                    title={fragment.name}
                    loading="lazy"
                  />
                )
              )}
            </span>
          </>
        )}
      </span>
    </div>
  );
});

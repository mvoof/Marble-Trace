import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { STREAM_CHAT_SETTINGS } from './settings-schema';

/**
 * Presentation only. The channel, sign-in and filters are app-wide and live in
 * the Settings page, because a chat source is not a property of a layout.
 */
// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['stream-chat'];

const { Row } = schemaRows(STREAM_CHAT_SETTINGS);

export const StreamChatSettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <>
      <Card title={t('settingsPanels.streamChat.feed')}>
        <div className={styles.fieldGroup}>
          <Row setting="maxMessages" input />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="messageLifetimeSeconds" input />
        </div>
      </Card>

      <Card title={t('settingsPanels.streamChat.visibleElements')}>
        <div className={styles.fieldGroup}>
          <Row setting="compactRows" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showPlatformGlyph" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showBadges" />
        </div>

        <Row setting="badgeImages" dependsOn="showBadges" />

        <div className={styles.fieldGroup}>
          <Row setting="showEvents" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showFollows" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showBanner" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showFooter" />
        </div>

        <Row setting="showActivity" dependsOn="showFooter" />

        <div className={styles.fieldGroup}>
          <Row setting="showPlaceholder" />
        </div>
      </Card>
    </>
  );
});

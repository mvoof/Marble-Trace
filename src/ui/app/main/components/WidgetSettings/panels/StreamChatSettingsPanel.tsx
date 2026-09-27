import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber } from 'antd';
import { StreamChatWidgetSettings } from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows, usePanelWidgetId } from './setting-rows';

const WIDGET_ID = 'stream-chat';

const MIN_MESSAGES = 3;
const MAX_MESSAGES = 200;
const MAX_LIFETIME_SECONDS = 600;

/**
 * Presentation only. The channel, sign-in and filters are app-wide and live in
 * the Settings page, because a chat source is not a property of a layout.
 */
// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['stream-chat'];

const { SwitchRow } = panelRows<StreamChatWidgetSettings>();

export const StreamChatSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId(WIDGET_ID);
  const { t } = useTranslation('widgets');

  const settings =
    liveWidgets.getSettings<StreamChatWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<StreamChatWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title={t('settingsPanels.streamChat.feed')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.streamChat.maxMessages')}
            desc={t('settingsPanels.streamChat.maxMessagesDesc')}
          >
            <InputNumber
              min={MIN_MESSAGES}
              max={MAX_MESSAGES}
              value={settings.maxMessages}
              onChange={(value) =>
                update({ maxMessages: value ?? settings.maxMessages })
              }
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.streamChat.messageLifetime')}
            desc={t('settingsPanels.streamChat.messageLifetimeDesc')}
          >
            <InputNumber
              min={0}
              max={MAX_LIFETIME_SECONDS}
              value={settings.messageLifetimeSeconds}
              onChange={(value) =>
                update({ messageLifetimeSeconds: value ?? 0 })
              }
            />
          </SettingRow>
        </div>
      </Card>

      <Card title={t('settingsPanels.streamChat.visibleElements')}>
        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="compactRows"
            title={t('settingsPanels.streamChat.compactRows')}
            desc={t('settingsPanels.streamChat.compactRowsDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showPlatformGlyph"
            title={t('settingsPanels.streamChat.showPlatformGlyph')}
            desc={t('settingsPanels.streamChat.showPlatformGlyphDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showBadges"
            title={t('settingsPanels.streamChat.showBadges')}
            desc={t('settingsPanels.streamChat.showBadgesDesc')}
          />
        </div>

        <SwitchRow
          settingKey="badgeImages"
          dependsOn="showBadges"
          title={t('settingsPanels.streamChat.badgeImages')}
          desc={t('settingsPanels.streamChat.badgeImagesDesc')}
        />

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showEvents"
            title={t('settingsPanels.streamChat.showEvents')}
            desc={t('settingsPanels.streamChat.showEventsDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showFollows"
            title={t('settingsPanels.streamChat.showFollows')}
            desc={t('settingsPanels.streamChat.showFollowsDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showBanner"
            title={t('settingsPanels.streamChat.showBanner')}
            desc={t('settingsPanels.streamChat.showBannerDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showFooter"
            title={t('settingsPanels.streamChat.showFooter')}
            desc={t('settingsPanels.streamChat.showFooterDesc')}
          />
        </div>

        <SwitchRow
          settingKey="showActivity"
          dependsOn="showFooter"
          title={t('settingsPanels.streamChat.showActivity')}
          desc={t('settingsPanels.streamChat.showActivityDesc')}
        />

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showPlaceholder"
            title={t('settingsPanels.streamChat.showPlaceholder')}
            desc={t('settingsPanels.streamChat.showPlaceholderDesc')}
          />
        </div>
      </Card>
    </>
  );
});

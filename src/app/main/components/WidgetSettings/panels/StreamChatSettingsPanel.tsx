import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Switch } from 'antd';
import { StreamChatWidgetSettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

const WIDGET_ID = 'stream-chat';

const MIN_MESSAGES = 3;
const MAX_MESSAGES = 200;
const MAX_LIFETIME_SECONDS = 600;

/**
 * Presentation only. The channel, sign-in and filters are app-wide and live in
 * the Settings page, because a chat source is not a property of a layout.
 */
export const StreamChatSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<StreamChatWidgetSettings>(WIDGET_ID);

  const update = (partial: Partial<StreamChatWidgetSettings>) => {
    widgetSettings.updateUserSettings(WIDGET_ID, {
      ...settings,
      ...partial,
    });
  };

  const toggles = [
    {
      titleKey: 'settingsPanels.streamChat.compactRows',
      descKey: 'settingsPanels.streamChat.compactRowsDesc',
      value: settings.compactRows,
      key: 'compactRows',
    },
    {
      titleKey: 'settingsPanels.streamChat.showPlatformGlyph',
      descKey: 'settingsPanels.streamChat.showPlatformGlyphDesc',
      value: settings.showPlatformGlyph,
      key: 'showPlatformGlyph',
    },
    {
      titleKey: 'settingsPanels.streamChat.showBadges',
      descKey: 'settingsPanels.streamChat.showBadgesDesc',
      value: settings.showBadges,
      key: 'showBadges',
    },
    {
      titleKey: 'settingsPanels.streamChat.badgeImages',
      descKey: 'settingsPanels.streamChat.badgeImagesDesc',
      value: settings.badgeImages,
      key: 'badgeImages',
    },
    {
      titleKey: 'settingsPanels.streamChat.showEvents',
      descKey: 'settingsPanels.streamChat.showEventsDesc',
      value: settings.showEvents,
      key: 'showEvents',
    },
    {
      titleKey: 'settingsPanels.streamChat.showBanner',
      descKey: 'settingsPanels.streamChat.showBannerDesc',
      value: settings.showBanner,
      key: 'showBanner',
    },
    {
      titleKey: 'settingsPanels.streamChat.showFooter',
      descKey: 'settingsPanels.streamChat.showFooterDesc',
      value: settings.showFooter,
      key: 'showFooter',
    },
    {
      titleKey: 'settingsPanels.streamChat.showActivity',
      descKey: 'settingsPanels.streamChat.showActivityDesc',
      value: settings.showActivity,
      key: 'showActivity',
    },
  ] as const;

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
        {toggles.map((item) => (
          <div key={item.key} className={styles.fieldGroup}>
            <SettingRow title={t(item.titleKey)} desc={t(item.descKey)}>
              <Switch
                checked={item.value}
                onChange={(value) => update({ [item.key]: value })}
              />
            </SettingRow>
          </div>
        ))}
      </Card>
    </>
  );
});

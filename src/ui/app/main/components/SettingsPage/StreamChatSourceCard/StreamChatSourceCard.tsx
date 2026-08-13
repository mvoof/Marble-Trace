import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Input, Switch, Tag } from 'antd';
import { openUrl } from '@tauri-apps/plugin-opener';

import {
  useAppSettingsStore,
  useTwitchAuthStore,
} from '@store/root-store-context';

import styles from './StreamChatSourceCard.module.scss';

/**
 * Chat source settings. App-wide on purpose: a channel belongs to the account,
 * not to a layout, and one connection then serves every layout instead of
 * reconnecting whenever the active layout changes.
 */
export const StreamChatSourceCard = observer(() => {
  const appSettings = useAppSettingsStore();
  const twitchAuth = useTwitchAuthStore();
  const { t } = useTranslation('main-app');

  const settings = appSettings.appSettings;

  const handleOpenActivate = () => {
    if (twitchAuth.deviceCode) {
      void openUrl(twitchAuth.deviceCode.verificationUri);
    }
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>{t('settingsPage.streamChat.title')}</h3>

      <div className={styles.cardContent}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPage.streamChat.twitchChannel')}
          </span>

          <Input
            value={settings.streamChatTwitchChannel}
            placeholder={t('settingsPage.streamChat.twitchChannelPlaceholder')}
            onChange={(event) =>
              appSettings.setStreamChatTwitchChannel(event.target.value)
            }
          />

          <span className={styles.fieldDesc}>
            {t('settingsPage.streamChat.twitchChannelDesc')}
          </span>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPage.streamChat.youtubeTarget')}
          </span>

          <Input
            value={settings.streamChatYoutubeTarget}
            placeholder={t('settingsPage.streamChat.youtubeTargetPlaceholder')}
            onChange={(event) =>
              appSettings.setStreamChatYoutubeTarget(event.target.value)
            }
          />

          <span className={styles.fieldDesc}>
            {t('settingsPage.streamChat.youtubeTargetDesc')}
          </span>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                {t('settingsPage.streamChat.hideCommands')}
              </div>

              <div className={styles.fieldDesc}>
                {t('settingsPage.streamChat.hideCommandsDesc')}
              </div>
            </div>

            <Switch
              checked={settings.streamChatHideCommands}
              onChange={(value) => appSettings.setStreamChatHideCommands(value)}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPage.streamChat.ignoredBots')}
          </span>

          <Input
            value={settings.streamChatIgnoredBots}
            onChange={(event) =>
              appSettings.setStreamChatIgnoredBots(event.target.value)
            }
          />

          <span className={styles.fieldDesc}>
            {t('settingsPage.streamChat.ignoredBotsDesc')}
          </span>
        </div>

        <div className={styles.divider} />

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPage.streamChat.signInTitle')}
          </span>

          <span className={styles.fieldDesc}>
            {t('settingsPage.streamChat.signInDesc')}
          </span>
        </div>

        {/* Only worth showing when the build has no id of its own — otherwise
            it is an advanced override nobody needs to touch. */}
        {!twitchAuth.hasBakedClientId && (
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>
              {t('settingsPage.streamChat.clientId')}
            </span>

            <Input
              value={settings.streamChatTwitchClientId}
              onChange={(event) =>
                appSettings.setStreamChatTwitchClientId(event.target.value)
              }
            />

            <span className={styles.fieldDesc}>
              {t('settingsPage.streamChat.clientIdDesc')}
            </span>
          </div>
        )}

        {twitchAuth.isSignedIn ? (
          <div className={styles.fieldRow}>
            <Tag color="green">
              {twitchAuth.login ?? t('settingsPage.streamChat.signedIn')}
            </Tag>

            <Button onClick={() => void twitchAuth.signOut()}>
              {t('settingsPage.streamChat.signOut')}
            </Button>
          </div>
        ) : twitchAuth.deviceCode ? (
          <div className={styles.deviceBox}>
            <span className={styles.deviceCode}>
              {twitchAuth.deviceCode.userCode}
            </span>

            <span className={styles.fieldDesc}>
              {t('settingsPage.streamChat.deviceHint')}
            </span>

            <div className={styles.fieldRow}>
              <Button type="primary" onClick={handleOpenActivate}>
                {t('settingsPage.streamChat.openActivate')}
              </Button>

              <Button onClick={() => twitchAuth.cancel()}>
                {t('settingsPage.streamChat.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.fieldRow}>
            <Button onClick={() => void twitchAuth.start()}>
              {t('settingsPage.streamChat.signIn')}
            </Button>
          </div>
        )}

        {twitchAuth.error && (
          <span className={styles.error}>
            {t(`settingsPage.streamChat.errors.${twitchAuth.error}`, {
              defaultValue: twitchAuth.error,
            })}
          </span>
        )}
      </div>
    </div>
  );
});

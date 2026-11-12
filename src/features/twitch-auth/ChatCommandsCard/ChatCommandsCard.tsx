import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Alert, Button, InputNumber, Switch } from 'antd';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useTwitchAuthStore } from '@features/twitch-auth/twitch-auth-context';
import type { ChatCommand } from '@shared/contracts/generated/bindings';

import styles from './ChatCommandsCard.module.scss';

const COMMANDS: ChatCommand[] = [
  'pos',
  'gap',
  'lap',
  'best',
  'sof',
  'car',
  'info',
  'weather',
  'lastrace',
  'fuel',
  'commands',
];

const MIN_COOLDOWN_SECONDS = 5;
const MAX_COOLDOWN_SECONDS = 300;
/** The backend never goes below this: it keeps replies under the Twitch limit. */
const MIN_GLOBAL_COOLDOWN_SECONDS = 2;

/**
 * Viewers' commands in Twitch chat. Answered from the streamer's own account,
 * so the card says what stands in the way while the feature is on.
 */
export const ChatCommandsCard = observer(() => {
  const appSettings = useAppSettingsStore();
  const twitchAuth = useTwitchAuthStore();
  const { t } = useTranslation('main-app');

  const settings = appSettings.appSettings;
  const channel = settings.streamChatTwitchChannel
    .trim()
    .replace(/^#/, '')
    .toLowerCase();
  const isOwnChannel = twitchAuth.login?.toLowerCase() === channel;

  const handleCooldownChange = (value: number | null) => {
    if (value !== null) {
      appSettings.update({ streamChatCommandCooldownSeconds: value });
    }
  };

  const handleGlobalCooldownChange = (value: number | null) => {
    if (value !== null) {
      appSettings.update({ streamChatCommandGlobalCooldownSeconds: value });
    }
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>
        {t('settingsPage.streamChat.commands.title')}
      </h3>

      <div className={styles.cardContent}>
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                {t('settingsPage.streamChat.commands.enabled')}
              </div>

              <div className={styles.fieldDesc}>
                {t('settingsPage.streamChat.commands.enabledDesc')}
              </div>
            </div>

            <Switch
              checked={settings.streamChatCommandsEnabled}
              onChange={(value) =>
                appSettings.update({ streamChatCommandsEnabled: value })
              }
            />
          </div>

          {settings.streamChatCommandsEnabled && !twitchAuth.isSignedIn && (
            <Alert
              className={styles.notice}
              type="warning"
              showIcon
              title={t('settingsPage.streamChat.commands.needsSignIn')}
            />
          )}

          {settings.streamChatCommandsEnabled && twitchAuth.needsReconnect && (
            <Alert
              className={styles.notice}
              type="warning"
              showIcon
              title={t('settingsPage.streamChat.commands.needsReconnect')}
              action={
                <Button size="small" onClick={() => void twitchAuth.start()}>
                  {t('settingsPage.streamChat.reconnect')}
                </Button>
              }
            />
          )}

          {settings.streamChatCommandsEnabled &&
            twitchAuth.isSignedIn &&
            !isOwnChannel && (
              <Alert
                className={styles.notice}
                type="warning"
                showIcon
                title={t('settingsPage.streamChat.commands.ownChannelOnly')}
              />
            )}
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                {t('settingsPage.streamChat.commands.cooldown')}
              </div>

              <div className={styles.fieldDesc}>
                {t('settingsPage.streamChat.commands.cooldownDesc')}
              </div>
            </div>

            <InputNumber
              min={MIN_COOLDOWN_SECONDS}
              max={MAX_COOLDOWN_SECONDS}
              value={settings.streamChatCommandCooldownSeconds}
              onChange={handleCooldownChange}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                {t('settingsPage.streamChat.commands.globalCooldown')}
              </div>

              <div className={styles.fieldDesc}>
                {t('settingsPage.streamChat.commands.globalCooldownDesc')}
              </div>
            </div>

            <InputNumber
              min={MIN_GLOBAL_COOLDOWN_SECONDS}
              max={MAX_COOLDOWN_SECONDS}
              value={settings.streamChatCommandGlobalCooldownSeconds}
              onChange={handleGlobalCooldownChange}
            />
          </div>
        </div>

        {COMMANDS.map((command) => (
          <div key={command} className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.commandName}>!{command}</div>

                <div className={styles.fieldDesc}>
                  {t(`settingsPage.streamChat.commands.list.${command}`)}
                </div>
              </div>

              <Switch
                checked={settings.streamChatCommandSwitches[command]}
                onChange={(value) =>
                  appSettings.setStreamChatCommandSwitch(command, value)
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

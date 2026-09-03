import { useCallback, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
  App,
  Button,
  Flex,
  Input,
  InputNumber,
  Switch,
  Tag,
  Tooltip,
} from 'antd';
import { Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';

import { getRemoteServerInfo } from '@platform/services/remote.service';
import {
  useAppSettingsStore,
  useLayoutsStore,
  useRemoteDevicesStore,
} from '@store/root-store-context';
import type { RemoteServerInfo } from '@/types/bindings';
import { RemoteScreenRow } from './RemoteScreenRow';
import { SettingsCard } from '../SettingsCard';
import styles from '../SettingsPage.module.scss';

/** The server reports client counts, which only change on the network. */
const STATUS_POLL_MS = 3000;

const MIN_PORT = 1024;
const MAX_PORT = 65535;
const MIN_HZ = 5;
const MAX_HZ = 60;

const ICON_SIZE = 14;

/** Stands in for the token while it is covered. */
const MASK = '•'.repeat(12);

interface CommittedNumberProps {
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  /** Unit label drawn inside the field. */
  suffix?: string;
  onCommit: (value: number) => void;
}

/**
 * A number field that reports only a finished value.
 *
 * `InputNumber` fires `onChange` per keystroke, so typing a port walks through
 * every prefix of it — and each one restarts the remote server on a port the
 * user never asked for. The draft is held locally and committed on blur or
 * Enter, clamped to the range the plain `min`/`max` only enforce on blur.
 */
const CommittedNumberInput = observer(
  ({ value, min, max, disabled, suffix, onCommit }: CommittedNumberProps) => {
    const [draft, setDraft] = useState<number | null>(value);

    // A value changed anywhere but in this field — a reset, a sync — still has
    // to show up here.
    useEffect(() => {
      setDraft(value);
    }, [value]);

    const commit = () => {
      if (draft === null) {
        setDraft(value);

        return;
      }

      const clamped = Math.min(max, Math.max(min, Math.round(draft)));

      setDraft(clamped);

      if (clamped !== value) onCommit(clamped);
    };

    return (
      <InputNumber
        size="small"
        min={min}
        max={max}
        suffix={suffix}
        value={draft}
        disabled={disabled}
        onChange={setDraft}
        onBlur={commit}
        onPressEnter={commit}
      />
    );
  }
);

export const RemoteScreensSection = observer(() => {
  const appSettings = useAppSettingsStore();
  const layouts = useLayoutsStore();
  const remoteDevices = useRemoteDevicesStore();
  const { message } = App.useApp();
  const { t } = useTranslation('main-app');

  // The token is the one secret on this page, and this page gets captured:
  // the user streams, and a window capture would put it on air. Hidden until
  // asked for, and never remembered — every visit starts covered.
  const [revealed, setRevealed] = useState(false);

  const [info, setInfo] = useState<RemoteServerInfo | null>(null);

  const settings = appSettings.appSettings;
  const { remoteEnabled } = settings;
  const { serverError } = remoteDevices;

  useEffect(() => {
    if (!remoteEnabled) {
      setInfo(null);

      return;
    }

    let cancelled = false;

    const poll = () => {
      void getRemoteServerInfo()
        .then((next) => {
          if (!cancelled) setInfo(next);
        })
        .catch(() => {
          if (!cancelled) setInfo(null);
        });
    };

    poll();

    const timer = setInterval(poll, STATUS_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    remoteEnabled,
    settings.remotePort,
    settings.remoteLan,
    remoteDevices.restartToken,
  ]);

  // Built from what the server reports, not from the stored settings: the two
  // differ for as long as it takes a changed port or token to restart the
  // server, and a link copied in that window would not open.
  const screenUrl = useCallback(
    (slug: string) => {
      if (!info?.running) return '';

      const query = info.token ? `?t=${info.token}` : '';

      return `http://${info.ip}:${info.port}/r/${slug}${query}`;
    },
    [info]
  );

  const remoteScreens = layouts.activeRemoteScreens;

  return (
    <SettingsCard title={t('settingsPage.remote.title')}>
      <div className={styles.fieldGroup}>
        <div className={styles.fieldTitle}>
          {t('settingsPage.remote.enableTitle')}
        </div>

        <div className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}>
          {t('settingsPage.remote.enableDesc')}
        </div>

        <Flex align="center" gap={12}>
          <Switch
            checked={remoteEnabled}
            onChange={(checked) => appSettings.setRemoteEnabled(checked)}
          />

          {remoteEnabled && info?.running && (
            <Tag color="green">
              {t('settingsPage.remote.running', {
                ip: info.ip,
                port: info.port,
              })}
            </Tag>
          )}

          {remoteEnabled && info && !info.running && (
            <>
              <Tag color="red">{t('settingsPage.remote.stopped')}</Tag>

              <Button
                size="small"
                icon={<RefreshCw size={ICON_SIZE} />}
                onClick={() => remoteDevices.requestRestart()}
              >
                {t('settingsPage.remote.retryStart')}
              </Button>
            </>
          )}

          {remoteEnabled && info?.running && info.clientCount > 0 && (
            <Tag color="blue">
              {t('settingsPage.remote.clients', { count: info.clientCount })}
            </Tag>
          )}
        </Flex>

        {remoteEnabled && info && !info.running && serverError && (
          <div className={styles.remoteServerError}>{serverError}</div>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldTitle}>
          {t('settingsPage.remote.portTitle')}
        </div>

        <div className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}>
          {t('settingsPage.remote.portDesc')}
        </div>

        <Flex align="center" gap={12}>
          <CommittedNumberInput
            min={MIN_PORT}
            max={MAX_PORT}
            value={settings.remotePort}
            disabled={!remoteEnabled}
            onCommit={(value) => appSettings.setRemotePort(value)}
          />

          <CommittedNumberInput
            min={MIN_HZ}
            max={MAX_HZ}
            suffix="Hz"
            value={settings.remoteTelemetryHz}
            disabled={!remoteEnabled}
            onCommit={(value) => appSettings.setRemoteTelemetryHz(value)}
          />
        </Flex>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldTitle}>
          {t('settingsPage.remote.securityTitle')}
        </div>

        <div className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}>
          {settings.remoteToken
            ? t('settingsPage.remote.securityDesc')
            : t('settingsPage.remote.securityDescOpen')}
        </div>

        <Flex align="center" gap={12} wrap>
          <Switch
            checked={settings.remoteLan}
            disabled={!remoteEnabled}
            onChange={(checked) => appSettings.setRemoteLan(checked)}
          />

          <span className={styles.fieldDesc}>
            {t('settingsPage.remote.lanLabel')}
          </span>
        </Flex>

        {!settings.remoteLan && (
          <div className={styles.fieldDesc}>
            {t('settingsPage.remote.lanOffHint')}
          </div>
        )}
      </div>

      {/* The token gets its own group: sat next to the network switch, its
          buttons read as belonging to that toggle. */}
      {remoteEnabled && settings.remoteToken && (
        <div className={styles.fieldGroup}>
          <div className={styles.fieldTitle}>
            {t('settingsPage.remote.tokenTitle')}
          </div>

          <div
            className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}
          >
            {t('settingsPage.remote.tokenDesc')}
          </div>

          <Flex align="center" gap={12} wrap>
            <Input
              readOnly
              className={styles.tokenInput}
              value={revealed ? settings.remoteToken : MASK}
              suffix={
                <Flex align="center" gap={2}>
                  <Tooltip
                    title={
                      revealed
                        ? t('settingsPage.remote.hideToken')
                        : t('settingsPage.remote.showToken')
                    }
                  >
                    <Button
                      size="small"
                      type="text"
                      aria-label={
                        revealed
                          ? t('settingsPage.remote.hideToken')
                          : t('settingsPage.remote.showToken')
                      }
                      icon={
                        revealed ? (
                          <EyeOff size={ICON_SIZE} />
                        ) : (
                          <Eye size={ICON_SIZE} />
                        )
                      }
                      onClick={() => setRevealed(!revealed)}
                    />
                  </Tooltip>

                  {/* Copying works while the token stays covered — there is no
                      reason to put it on screen just to move it elsewhere. */}
                  <Tooltip title={t('settingsPage.remote.copyToken')}>
                    <Button
                      size="small"
                      type="text"
                      aria-label={t('settingsPage.remote.copyToken')}
                      icon={<Copy size={ICON_SIZE} />}
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(settings.remoteToken)
                          .then(() => {
                            message.success(
                              t('settingsPage.remote.tokenCopied')
                            );
                          });
                      }}
                    />
                  </Tooltip>
                </Flex>
              }
            />

            <Button
              size="small"
              icon={<RefreshCw size={ICON_SIZE} />}
              onClick={() => appSettings.regenerateRemoteToken()}
            >
              {t('settingsPage.remote.regenerateToken')}
            </Button>
          </Flex>
        </div>
      )}

      <div className={styles.fieldGroup}>
        <div className={styles.fieldTitle}>
          {t('settingsPage.remote.screensTitle')}
        </div>

        <div className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}>
          {remoteScreens.length === 0
            ? t('settingsPage.remote.screensEmpty')
            : t('settingsPage.remote.screensDesc')}
        </div>

        {remoteScreens.map((screen) => (
          <RemoteScreenRow
            key={screen.name}
            screen={screen}
            url={screenUrl(screen.slug ?? '')}
            device={remoteDevices.bySlug(screen.slug ?? '')}
            revealed={revealed}
          />
        ))}
      </div>
    </SettingsCard>
  );
});

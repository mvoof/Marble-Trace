import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Button, ColorPicker, Flex, QRCode, Tag, Tooltip } from 'antd';
import { Copy, Maximize2, EyeOff } from 'lucide-react';

import { useWidgetSettingsStore } from '@store/root-store-context';
import { DEFAULT_REMOTE_BACKGROUND } from '@utils/remote-screen';
import type { RemoteDevice } from '@/types/bindings';
import type { LayoutMonitor } from '@/types/widget-settings';
import styles from '../SettingsPage.module.scss';
import rowStyles from './RemoteScreenRow.module.scss';

const ICON_SIZE = 14;

/** Big enough that a phone camera resolves the modules of a long URL. */
const QR_SIZE = 184;

interface RemoteScreenRowProps {
  screen: LayoutMonitor;
  url: string;
  device?: RemoteDevice;
  /** Whether the token — and with it the QR code — may be shown on screen. */
  revealed: boolean;
}

/** Stands in for the token in a URL that is about to be displayed. */
const maskToken = (url: string): string =>
  url.replace(/\?t=[^&]*/, '?t=' + '•'.repeat(8));

/**
 * One remote screen in settings: how to reach it, and what the device that
 * opened it reports about itself.
 *
 * The QR code is the point of the address column — typing `192.168.x.x:8787`
 * on a tablet by hand is exactly the friction this feature exists to avoid.
 */
export const RemoteScreenRow = observer(
  ({ screen, url, device, revealed }: RemoteScreenRowProps) => {
    const widgetSettings = useWidgetSettingsStore();
    const { message } = App.useApp();
    const { t } = useTranslation('main-app');

    const background = screen.background ?? DEFAULT_REMOTE_BACKGROUND;
    const isTransparent = background === 'transparent';

    const handleBackground = (color: string) => {
      widgetSettings.setRemoteScreenBackground(screen.name, color);
    };

    const handleCopy = () => {
      void navigator.clipboard.writeText(url).then(() => {
        message.success(t('settingsPage.remote.urlCopied'));
      });
    };

    // The layout was drawn for the stored bounds; a device reporting something
    // else is offered, never applied — resizing moves every widget on it.
    const reported = device
      ? { width: device.viewportWidth, height: device.viewportHeight }
      : null;

    const mismatched =
      reported !== null &&
      reported.width > 0 &&
      (reported.width !== screen.bounds.width ||
        reported.height !== screen.bounds.height);

    const handleFit = () => {
      if (!reported) return;

      widgetSettings.resizeRemoteScreen(
        screen.name,
        reported.width,
        reported.height
      );

      message.success(t('settingsPage.remote.sizeApplied'));
    };

    return (
      <div className={styles.fieldGroup}>
        <Flex gap={16} align="flex-start" wrap>
          {/* SVG rather than the default canvas: a canvas is rasterised at CSS
              size and comes out soft on a scaled display, and a camera reading
              a blurred code has to work much harder.

              The white ground and the quiet zone are explicit too — the
              settings page is dark, and a transparent code is black on black to
              a camera. The lowest correction level keeps the modules as large
              as possible, which is what matters on a screen nobody is going to
              smudge. */}
          {/* A stream screen is opened by OBS on this machine, so there is
              nothing to point a camera at — the address is copied, never
              scanned. */}
          {url && !revealed ? (
            <div
              className={rowStyles.qrPlaceholder}
              style={{ width: QR_SIZE, height: QR_SIZE }}
            >
              <EyeOff size={20} />
              <span>{t('settingsPage.remote.qrHidden')}</span>
            </div>
          ) : null}

          {url && revealed ? (
            <QRCode
              type="svg"
              value={url}
              size={QR_SIZE}
              errorLevel="L"
              color="#000000"
              bgColor="#ffffff"
              bordered
            />
          ) : null}

          <Flex vertical gap={8} flex="1 1 260px">
            <Flex align="center" gap={8} wrap>
              <span className={styles.fieldTitle}>{screen.name}</span>

              <span className={styles.fieldDesc}>
                {screen.bounds.width}×{screen.bounds.height}
              </span>

              {device?.connected && (
                <Tag color="green">{t('settingsPage.remote.deviceOnline')}</Tag>
              )}
            </Flex>

            <span className={`${styles.fieldDesc} ${rowStyles.maskedUrl}`}>
              {url
                ? revealed
                  ? url
                  : maskToken(url)
                : t('settingsPage.remote.serverOffline')}
            </span>

            {/* The one thing that differs between a tablet and a browser
                source: what the page paints behind the widgets. */}
            <Flex align="center" gap={8} wrap>
              <span className={styles.fieldDesc}>
                {t('settingsPage.remote.backgroundLabel')}
              </span>

              <ColorPicker
                value={isTransparent ? null : background}
                allowClear
                onChange={(color) =>
                  handleBackground(color ? color.toRgbString() : 'transparent')
                }
                onClear={() => handleBackground('transparent')}
              />

              <span className={styles.fieldDesc}>
                {isTransparent
                  ? t('settingsPage.remote.backgroundTransparent')
                  : background}
              </span>
            </Flex>

            {isTransparent && (
              <span className={styles.fieldDesc}>
                {t('settingsPage.remote.obsHint', {
                  width: screen.bounds.width,
                  height: screen.bounds.height,
                })}
              </span>
            )}

            {reported && (
              <span className={styles.fieldDesc}>
                {t('settingsPage.remote.deviceReports', {
                  width: reported.width,
                  height: reported.height,
                  screenWidth: device?.screenWidth ?? 0,
                  screenHeight: device?.screenHeight ?? 0,
                })}
              </span>
            )}

            {reported && !device?.standalone && (
              <span className={styles.fieldDesc}>
                {t('settingsPage.remote.addToHomeScreenHint')}
              </span>
            )}

            <Flex gap={8} wrap>
              <Button
                size="small"
                icon={<Copy size={ICON_SIZE} />}
                disabled={!url}
                onClick={handleCopy}
              >
                {t('settingsPage.remote.copyUrl')}
              </Button>

              {mismatched && (
                <Tooltip title={t('settingsPage.remote.fitToDeviceTooltip')}>
                  <Button
                    size="small"
                    icon={<Maximize2 size={ICON_SIZE} />}
                    onClick={handleFit}
                  >
                    {t('settingsPage.remote.fitToDevice', {
                      width: reported.width,
                      height: reported.height,
                    })}
                  </Button>
                </Tooltip>
              )}
            </Flex>
          </Flex>
        </Flex>
      </div>
    );
  }
);

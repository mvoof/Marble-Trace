import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Button, Flex } from 'antd';
import { Copy } from 'lucide-react';

import { useWidgetSettingsStore } from '@store/root-store-context';
import { WIDGET_SOURCE_SLUG } from '@utils/remote-screen';
import styles from '../SettingsPage.module.scss';

const ICON_SIZE = 14;

interface WidgetStreamLinksProps {
  /** Builds the address of a screen, empty while the server is not running. */
  screenUrl: (slug: string) => string;
}

/**
 * A browser-source address for every widget of the layout, one per widget.
 *
 * These are not tied to a remote screen: the URL reads from a pseudo-screen
 * carrying the whole layout, so a widget standing on the game monitor can be
 * put in a scene without being moved anywhere first. What the page draws is
 * that widget's own rectangle, on a transparent ground.
 */
export const WidgetStreamLinks = observer(
  ({ screenUrl }: WidgetStreamLinksProps) => {
    const widgetSettings = useWidgetSettingsStore();
    const { message } = App.useApp();
    const { t } = useTranslation('main-app');

    const url = screenUrl(WIDGET_SOURCE_SLUG);
    const widgets = widgetSettings.allWidgets;

    const handleCopy = (widgetId: string) => {
      const separator = url.includes('?') ? '&' : '?';

      void navigator.clipboard
        .writeText(`${url}${separator}widget=${encodeURIComponent(widgetId)}`)
        .then(() => {
          message.success(t('settingsPage.remote.urlCopied'));
        });
    };

    return (
      <div className={styles.fieldGroup}>
        <div className={styles.fieldTitle}>
          {t('settingsPage.remote.widgetLinksTitle')}
        </div>

        <div className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}>
          {url
            ? t('settingsPage.remote.widgetLinksDesc')
            : t('settingsPage.remote.serverOffline')}
        </div>

        <Flex gap={8} wrap>
          {widgets.map((widget) => (
            <Button
              key={widget.id}
              size="small"
              icon={<Copy size={ICON_SIZE} />}
              disabled={!url}
              onClick={() => handleCopy(widget.id)}
            >
              {widget.label}
            </Button>
          ))}
        </Flex>
      </div>
    );
  }
);

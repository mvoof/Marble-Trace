import { useMemo } from 'react';
import ReactDOM from 'react-dom';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '@ui/hooks/useClickOutside';
import { ConfigProvider, theme } from 'antd';
import { X } from 'lucide-react';
import { WidgetSettings } from '@ui/app/main/components/WidgetSettings/WidgetSettings';
import {
  WidgetEditorProvider,
  type WidgetEditor,
} from '@ui/app/main/components/WidgetSettings/WidgetEditorContext';
import {
  useLiveWidgetsStore,
  useSettingsMutationLog,
} from '@store/root-store-context';
import { useOverlayRoot } from '@store/overlay-root-context';
import type { LiveWidgetsView } from '@store/settings/live-widgets.store';
import type { SettingsMutationLog } from '@store/settings/mutation-log';
import type { SettingsClientStore } from '@store/settings/settings-client.store';
import { getWidgetLabel } from '@ui/app/widget-i18n';
import styles from './WidgetSettingsPopup.module.scss';

const POPUP_WIDTH = 500;
const POPUP_MAX_HEIGHT = 650;
const MARGIN = 8;

// The panels read the widget as drawn here — overrides included — and every
// write goes to main as a command. Nothing in the popup writes the store.
const overlayEditor = (
  liveWidgets: LiveWidgetsView,
  mutations: SettingsMutationLog,
  settingsClient: SettingsClientStore
): WidgetEditor => ({
  getWidget: (id) => liveWidgets.getWidget(id),
  getSettings: (id) => liveWidgets.getSettings(id),
  updateUserSettings: (id, partial) =>
    settingsClient.patchSettings(id, partial),
  getChangeToken: () => mutations.changeToken,
});

interface WidgetSettingsPopupProps {
  widgetId: string;
  onClose: () => void;
}

export const WidgetSettingsPopup = observer(
  ({ widgetId, onClose }: WidgetSettingsPopupProps) => {
    const liveWidgets = useLiveWidgetsStore();
    const mutations = useSettingsMutationLog();
    const { settingsClient } = useOverlayRoot();
    const editor = useMemo(
      () => overlayEditor(liveWidgets, mutations, settingsClient),
      [liveWidgets, mutations, settingsClient]
    );
    const popupRef = useClickOutside<HTMLDialogElement>(onClose);
    const { t } = useTranslation('main-app');

    const widget = liveWidgets.getWidget(widgetId);

    if (!widget) {
      return null;
    }

    const widgetX = widget.userSettings.x;
    const widgetY = widget.userSettings.y;
    const widgetW = widget.userSettings.currentWidth;

    const screenH = window.innerHeight;

    const spaceLeft = widgetX - MARGIN;
    const popupX =
      spaceLeft >= POPUP_WIDTH
        ? widgetX - POPUP_WIDTH - MARGIN
        : widgetX + widgetW + MARGIN;

    const popupY = Math.max(
      MARGIN,
      Math.min(widgetY, screenH - POPUP_MAX_HEIGHT - MARGIN)
    );

    return ReactDOM.createPortal(
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorBgBase: '#0d0e12',
            colorBgContainer: '#15161a',
            colorBgElevated: '#1d1f25',
            colorPrimary: '#e0e0e0',
            zIndexPopupBase: 100000,
          },
        }}
      >
        <dialog
          ref={popupRef}
          className={styles.popup}
          style={{ left: popupX, top: popupY, width: POPUP_WIDTH }}
          aria-label={t('widgetSettingsPopup.ariaLabel', {
            label: getWidgetLabel(t, widget),
          })}
          open
        >
          <button
            type="button"
            className={styles.closeButton}
            title={t('widgetSettingsPopup.close')}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X />
          </button>

          <div className={styles.content}>
            <div className={styles.popupInner}>
              <WidgetEditorProvider editor={editor}>
                <WidgetSettings widgetId={widgetId} />
              </WidgetEditorProvider>
            </div>
          </div>
        </dialog>
      </ConfigProvider>,
      document.body
    );
  }
);

import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { observer } from 'mobx-react-lite';
import { ConfigProvider, theme } from 'antd';
import { X } from 'lucide-react';
import { WidgetSettings } from '@app/main/components/WidgetSettings/WidgetSettings';
import { useWidgetSettingsStore } from '@store/root-store-context';
import styles from './WidgetSettingsPopup.module.scss';

const POPUP_WIDTH = 420;
const POPUP_MAX_HEIGHT = 560;
const MARGIN = 8;

interface WidgetSettingsPopupProps {
  widgetId: string;
  onClose: () => void;
}

export const WidgetSettingsPopup = observer(
  ({ widgetId, onClose }: WidgetSettingsPopupProps) => {
    const widgetSettings = useWidgetSettingsStore();
    const popupRef = useRef<HTMLDialogElement>(null);

    const widget = widgetSettings.getWidget(widgetId);
    const widgetX = widget?.userSettings.x ?? 0;
    const widgetY = widget?.userSettings.y ?? 0;
    const widgetW = widget?.userSettings.currentWidth ?? 200;

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

    useEffect(() => {
      const onMouseDown = (e: MouseEvent) => {
        if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
          onClose();
        }
      };

      document.addEventListener('mousedown', onMouseDown);

      return () => document.removeEventListener('mousedown', onMouseDown);
    }, [onClose]);

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
          open
        >
          <button
            type="button"
            className={styles.closeButton}
            title="Close"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X />
          </button>

          <div className={styles.content}>
            <div className={styles.popupInner}>
              <WidgetSettings widgetId={widgetId} />
            </div>
          </div>
        </dialog>
      </ConfigProvider>,
      document.body
    );
  }
);

import { useLayoutEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented } from 'antd';
import { Maximize, Shrink } from 'lucide-react';
import {
  WidgetPreview,
  type PreviewRoom,
} from '../WidgetPreview/WidgetPreview';
import { WidgetSettings } from '@features/widget-settings/WidgetSettings';
import { DefaultsEditorProvider } from '@features/widget-settings/WidgetEditorContext';
import { WidgetBindingsSummary } from '@features/hotkey-bindings/WidgetBindingsSummary';
import { useMainNavigationStore } from '@features/main-navigation/main-navigation-context';
import type { WidgetPreviewPosition } from '@entities/app-settings/app-settings.store';
import styles from './WidgetWorkbench.module.scss';

type PreviewZoom = 'fit' | 'actual';

/**
 * The room the preview may take, read off a hidden box the stylesheet sizes:
 * the pane's width, and the height the page leaves it for this position.
 */
const usePreviewRoom = () => {
  const [roomBox, setRoomBox] = useState<HTMLDivElement | null>(null);
  const [room, setRoom] = useState<PreviewRoom | null>(null);

  useLayoutEffect(() => {
    if (!roomBox) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) =>
      setRoom({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    );

    resizeObserver.observe(roomBox);

    return () => resizeObserver.disconnect();
  }, [roomBox]);

  return { room, setRoomBox };
};

// One widget's page: the live preview on top (or to the left), held in view
// while the settings scroll. The parent owns which widget is active, the
// scenario it draws and where the preview goes. On top, the preview is as tall
// as its widget; on the left, it takes the window's height and every pixel the
// window grows by, the settings keeping their width.
export const WidgetWorkbench = observer(
  ({
    widgetId,
    scenarioId,
    previewPosition,
  }: {
    widgetId: string;
    scenarioId: string;
    previewPosition: WidgetPreviewPosition;
  }) => {
    const navigation = useMainNavigationStore();
    const { t } = useTranslation('main-app');
    const { room, setRoomBox } = usePreviewRoom();
    const [zoom, setZoom] = useState<PreviewZoom>('fit');
    const isLeft = previewPosition === 'left';

    return (
      <DefaultsEditorProvider>
        <div className={isLeft ? styles.rootPreviewLeft : styles.root}>
          <div className={styles.previewColumn}>
            <div className={styles.previewPane}>
              <div ref={setRoomBox} className={styles.room} aria-hidden />

              <WidgetPreview
                key={widgetId}
                widgetId={widgetId}
                scenarioId={scenarioId}
                room={room}
                fit={zoom === 'fit'}
                fillRoom={isLeft}
              />

              <Segmented<PreviewZoom>
                className={styles.zoomSwitch}
                size="small"
                value={zoom}
                onChange={setZoom}
                options={[
                  {
                    value: 'fit',
                    icon: <Shrink size={13} />,
                    title: t('widgetsPage.previewFit'),
                  },
                  {
                    value: 'actual',
                    icon: <Maximize size={13} />,
                    title: t('widgetsPage.previewActualSize'),
                  },
                ]}
              />
            </div>
          </div>

          <div className={styles.settingsPane}>
            {/* The page edits the widget's defaults, not a copy: the copy's
                hotkey mark is set where copies are, in the layout editor. */}
            <WidgetSettings
              widgetId={widgetId}
              hideHeader
              openCards
              hotkeys={
                <WidgetBindingsSummary
                  widgetType={widgetId}
                  onOpenHotkeys={() => navigation.openHotkeys(widgetId)}
                />
              }
            />
          </div>
        </div>
      </DefaultsEditorProvider>
    );
  }
);

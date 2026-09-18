import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';

import { ErrorBoundary } from '@ui/shared/ErrorBoundary';
import { widgetFrameStyle } from '@ui/app/widget-frame';
import { WidgetIdContext } from '@ui/app/overlay/components/WidgetContainer/WidgetIdContext';
import styles from './RemoteWidgetFrame.module.scss';
import {
  useLiveWidgetsStore,
  useWidgetAutoHideStore,
} from '@store/root-store-context';

interface RemoteWidgetFrameProps {
  widgetId: string;
  children: ReactNode;
}

/**
 * What `WidgetContainer` reduces to on a device that only watches: position,
 * size and the widget's own appearance.
 *
 * No dragging, no resize handles and no cursor handling — those all exist to
 * serve an overlay sitting on top of a running game, and none of them mean
 * anything in a browser. The scaling tokens are identical, so the widgets
 * themselves render exactly as they do on the monitor.
 *
 * A widget that hides itself does so here too: the pit bars, the radar and the
 * flags come and go on a stream source exactly as they do on the driver's
 * screen, which is the behaviour the widget was built with rather than an
 * overlay convenience. The app-level hides (game closed, garage) stay behind —
 * those answer "is the driver looking at this monitor", which a browser on the
 * network cannot be asked.
 */
export const RemoteWidgetFrame = observer(
  ({ widgetId, children }: RemoteWidgetFrameProps) => {
    const liveWidgets = useLiveWidgetsStore();
    const widgetAutoHide = useWidgetAutoHideStore();
    const widget = liveWidgets.getWidget(widgetId);

    if (!widget) {
      return null;
    }

    const isHidden = !widgetAutoHide.isVisible(widgetId);

    const { userSettings } = widget;

    const width = userSettings.currentWidth;
    const height = userSettings.currentHeight;
    const autoHeight = widget.autoHeight ?? false;
    const transparentContainer = widget.transparentContainer ?? false;

    const widgetScale = widget.scaleFromHeight
      ? height / widget.designHeight
      : width / widget.designWidth;

    const frameStyle = widgetFrameStyle({
      widgetId,
      userSettings,
      widgetScale,
      transparentContainer,
      autoHeight,
      hidden: isHidden,
    });

    return (
      <div
        className={`${styles.frame} ${isHidden ? styles.hidden : ''}`}
        data-widget-id={widgetId}
        style={{
          left: userSettings.x,
          top: userSettings.y,
          width,
          height: autoHeight ? 'auto' : height,
        }}
      >
        <ErrorBoundary>
          <div
            className={`${styles.inner} ${widget.overflowVisible ? styles.overflowVisible : ''}`}
            style={frameStyle}
          >
            <WidgetIdContext.Provider value={widgetId}>
              {isHidden ? null : children}
            </WidgetIdContext.Provider>
          </div>
        </ErrorBoundary>
      </div>
    );
  }
);

import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';

import { ErrorBoundary } from '@ui/shared/ErrorBoundary';
import { widgetFrameBorderRadius } from '@ui/app/widget-frame';
import { WidgetIdContext } from '@ui/app/overlay/components/WidgetContainer/WidgetIdContext';
import { withAlphaFactor } from '@utils/colors';
import styles from './RemoteWidgetFrame.module.scss';
import { useWidgetSettingsStore } from '@store/root-store-context';

interface RemoteWidgetFrameProps {
  widgetId: string;
  children: ReactNode;
}

/**
 * What `WidgetContainer` reduces to on a device that only watches: position,
 * size and the widget's own appearance.
 *
 * No dragging, no resize handles, no auto-hide and no cursor handling — those
 * all exist to serve an overlay sitting on top of a running game, and none of
 * them mean anything in a browser. The scaling tokens are identical, so the
 * widgets themselves render exactly as they do on the monitor.
 */
export const RemoteWidgetFrame = observer(
  ({ widgetId, children }: RemoteWidgetFrameProps) => {
    const widgetSettings = useWidgetSettingsStore();
    const widget = widgetSettings.getWidget(widgetId);

    if (!widget) {
      return null;
    }

    const { userSettings } = widget;

    const width = userSettings.currentWidth;
    const height = userSettings.currentHeight;
    const autoHeight = widget.autoHeight ?? false;
    const transparentContainer = widget.transparentContainer ?? false;

    const widgetScale = widget.scaleFromHeight
      ? height / widget.designHeight
      : width / widget.designWidth;

    const backgroundColor = withAlphaFactor(
      userSettings.backgroundColor,
      userSettings.backgroundOpacity ?? 1
    );

    const background = transparentContainer ? 'transparent' : backgroundColor;

    const borderColor = transparentContainer
      ? 'transparent'
      : userSettings.borderColor;

    const borderRadius = widgetFrameBorderRadius(
      widgetId,
      userSettings as unknown as Record<string, unknown>
    );

    return (
      <div
        className={styles.frame}
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
            style={
              {
                ...(autoHeight ? { height: 'auto' } : undefined),
                background,
                borderColor,
                borderWidth: transparentContainer ? 0 : undefined,
                borderRadius,
                ['--wfs']: widgetScale,
                ['--font-scale']: userSettings.fontScale,
                ['--widget-bg']: backgroundColor,
                ['--widget-border']: userSettings.borderColor,
              } as React.CSSProperties
            }
          >
            <WidgetIdContext.Provider value={widgetId}>
              {children}
            </WidgetIdContext.Provider>
          </div>
        </ErrorBoundary>
      </div>
    );
  }
);

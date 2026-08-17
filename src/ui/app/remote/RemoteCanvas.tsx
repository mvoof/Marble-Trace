import { observer } from 'mobx-react-lite';

import { componentForWidget } from '@ui/widgets/registry';
import { RemoteWidgetFrame } from './RemoteWidgetFrame';
import styles from './RemoteCanvas.module.scss';
import { useRemoteScreenStore } from '@store/remote/remote-screen-context';

/**
 * Draws one remote screen.
 *
 * Widget coordinates are virtual-desktop wide, exactly as in the overlay, so
 * the canvas shifts by the screen's own origin and is then scaled as a whole to
 * whatever viewport the browser actually gives us. Scaling the canvas rather
 * than the widgets keeps every `--wfs` identical to the monitor — a widget
 * cannot tell it is being rendered on a tablet.
 */
export const RemoteCanvas = observer(() => {
  const screen = useRemoteScreenStore();
  const { bounds } = screen;

  if (!bounds) {
    return null;
  }

  return (
    <div
      className={styles.viewport}
      style={{
        width: bounds.width * screen.scale,
        height: bounds.height * screen.scale,
      }}
    >
      <div
        className={styles.canvas}
        style={{
          width: bounds.width,
          height: bounds.height,
          transform: `scale(${screen.scale})`,
        }}
      >
        <div
          className={styles.origin}
          style={{ transform: `translate(${-bounds.x}px, ${-bounds.y}px)` }}
        >
          {screen.enabledWidgets.map((widget) => {
            const WidgetComponent = componentForWidget(widget.id);

            if (!WidgetComponent) return null;

            return (
              <RemoteWidgetFrame key={widget.id} widgetId={widget.id}>
                <WidgetComponent />
              </RemoteWidgetFrame>
            );
          })}
        </div>
      </div>
    </div>
  );
});

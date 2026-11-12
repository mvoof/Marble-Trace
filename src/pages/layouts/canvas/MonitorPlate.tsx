import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { GripHorizontal } from 'lucide-react';

import { resolveBackgroundSrc } from '@entities/layout/layout-background';
import type {
  LayoutMonitor,
  MonitorBounds,
} from '@shared/contracts/widget-settings';

import styles from './MonitorPlate.module.scss';

// One screen of the layout, drawn in desktop coordinates behind the widgets.
// Each monitor carries its own background image — a cockpit shot for the main
// screen, whatever sits on the others.
export const MonitorPlate = observer(
  ({
    monitor,
    image,
    fit,
    view,
    showGrid,
    gridSize,
    onDragStart,
    bounds,
    isBlocked = false,
  }: {
    monitor: LayoutMonitor;
    image?: string;
    fit: number;
    view: MonitorBounds;
    showGrid: boolean;
    gridSize: number;
    /** Present only for screens the user may re-park — remote ones in overview. */
    onDragStart?: (event: ReactMouseEvent) => void;
    /** Where to draw the plate while it is being dragged, ahead of the store. */
    bounds?: MonitorBounds;
    /** Drawn as rejected: dropping here would land on another screen. */
    isBlocked?: boolean;
  }) => {
    const [src, setSrc] = useState<string | undefined>();

    useEffect(() => {
      let active = true;

      if (!image) {
        setSrc(undefined);

        return;
      }

      resolveBackgroundSrc(image)
        .then((resolved) => {
          if (active) setSrc(resolved);
        })
        .catch((error: unknown) =>
          console.error('Failed to resolve background image:', error)
        );

      return () => {
        active = false;
      };
    }, [image]);

    const drawn = bounds ?? monitor.bounds;

    return (
      <div
        className={`${styles.monitorPlate} ${
          isBlocked ? styles.monitorPlateBlocked : ''
        }`}
        style={{
          left: (drawn.x - view.x) * fit,
          top: (drawn.y - view.y) * fit,
          width: drawn.width * fit,
          height: drawn.height * fit,
          backgroundImage: src ? `url(${src})` : undefined,
        }}
      >
        {showGrid && (
          <div
            className={styles.grid}
            aria-hidden="true"
            style={{
              backgroundSize: `${gridSize * fit}px ${gridSize * fit}px`,
            }}
          >
            <div className={styles.axisVertical} />
            <div className={styles.axisHorizontal} />
          </div>
        )}

        {/* The widget layer covers the plate, so a remote screen is moved by a
            grab bar drawn above it rather than by its whole surface — which
            also keeps a click on empty screen area clearing the selection. */}
        {onDragStart && (
          <div
            className={styles.plateHandle}
            role="presentation"
            onMouseDown={onDragStart}
          >
            <GripHorizontal size={11} />
            <span className={styles.plateHandleLabel}>{monitor.name}</span>
          </div>
        )}
      </div>
    );
  }
);

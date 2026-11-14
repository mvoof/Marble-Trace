import type { CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Tablet } from 'lucide-react';

import { useDisplaysStore } from '@entities/layout/displays-context';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';
import { cx } from '@shared/lib/class-names';
import { isRemoteMonitor } from '@shared/lib/remote-screen';
import type { MonitorBounds } from '@shared/contracts/widget-settings';

import { AddRemoteScreenButton } from '../toolbar/AddRemoteScreenButton';
import styles from './MonitorMap.module.scss';

const PERCENT = 100;

interface MapTile {
  name: string;
  bounds: MonitorBounds;
  /** Null for a monitor of the layout that is not plugged in. */
  number: number | null;
  label: string;
  isInLayout: boolean;
}

/** Each tile's place in the arrangement's bounding box, in percent. */
const tileStyle = (
  bounds: MonitorBounds,
  extent: MonitorBounds
): CSSProperties => ({
  left: `${((bounds.x - extent.x) / extent.width) * PERCENT}%`,
  top: `${((bounds.y - extent.y) / extent.height) * PERCENT}%`,
  width: `${(bounds.width / extent.width) * PERCENT}%`,
  height: `${(bounds.height / extent.height) * PERCENT}%`,
});

const extentOf = (tiles: MapTile[]): MonitorBounds => {
  const left = Math.min(...tiles.map((tile) => tile.bounds.x));
  const top = Math.min(...tiles.map((tile) => tile.bounds.y));
  const right = Math.max(
    ...tiles.map((tile) => tile.bounds.x + tile.bounds.width)
  );
  const bottom = Math.max(
    ...tiles.map((tile) => tile.bounds.y + tile.bounds.height)
  );

  return { x: left, y: top, width: right - left, height: bottom - top };
};

/**
 * The physical monitors as they stand on the desk, each labelled the way the
 * driver knows it — "1 · DELL U2723 · 2560×1440 · primary" — and the browser
 * screens as chips beside them. A click edits that one screen; an attached
 * monitor not in the layout yet joins it.
 */
export const MonitorMap = observer(() => {
  const displays = useDisplaysStore();
  const layouts = useLayoutsStore();
  const editorUi = useLayoutEditorUiStore();
  const { t } = useTranslation('main-app');

  const layoutMonitors = layouts.editingLayout?.monitors ?? [];
  const layoutNames = new Set(layoutMonitors.map((monitor) => monitor.name));
  const attachedNames = new Set(
    displays.displays.map((display) => display.name)
  );

  const attachedTiles: MapTile[] = displays.displays.map((display) => {
    const parts = [
      display.model ?? display.name,
      `${display.resolution.width}×${display.resolution.height}`,
      ...(display.isPrimary ? [t('monitorMap.primary')] : []),
    ];

    return {
      name: display.name,
      bounds: display.bounds,
      number: display.number,
      label: parts.join(' · '),
      isInLayout: layoutNames.has(display.name),
    };
  });

  // A monitor the layout covers but the desk lacks today keeps its place on
  // the map, so its widgets stay reachable.
  const unpluggedTiles: MapTile[] = layoutMonitors
    .filter(
      (monitor) => !isRemoteMonitor(monitor) && !attachedNames.has(monitor.name)
    )
    .map((monitor) => ({
      name: monitor.name,
      bounds: monitor.bounds,
      number: null,
      label: `${monitor.name} · ${t('monitorMap.notConnected')}`,
      isInLayout: true,
    }));

  const tiles = [...attachedTiles, ...unpluggedTiles];
  const remoteScreens = layoutMonitors.filter(isRemoteMonitor);

  const handleSelect = (tile: MapTile) => {
    if (!tile.isInLayout) {
      layouts.addMonitor({ name: tile.name, bounds: tile.bounds });
    }

    editorUi.focusMonitor(tile.name);
  };

  const extent = tiles.length > 0 ? extentOf(tiles) : null;

  return (
    <section className={styles.root}>
      <div className={styles.map}>
        {extent && (
          <div
            className={styles.stage}
            style={{ aspectRatio: `${extent.width} / ${extent.height}` }}
          >
            {tiles.map((tile) => (
              <button
                key={tile.name}
                type="button"
                className={cx(
                  styles.tile,
                  !tile.isInLayout && styles.tileOutside,
                  tile.number === null && styles.tileUnplugged,
                  editorUi.focusedMonitorName === tile.name &&
                    styles.tileSelected
                )}
                style={tileStyle(tile.bounds, extent)}
                title={
                  tile.isInLayout ? tile.label : t('monitorMap.addToLayout')
                }
                onClick={() => handleSelect(tile)}
              >
                <span className={styles.tileLabel}>
                  {tile.number !== null && <b>{tile.number}</b>}
                  {tile.number !== null && ' · '}
                  {tile.label}
                </span>

                {!tile.isInLayout && (
                  <span className={styles.tileHint}>
                    {t('monitorMap.notInLayout')}
                  </span>
                )}

                {displays.isIdentifying && tile.number !== null && (
                  <span className={styles.bigNumber}>{tile.number}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.remotes}>
        <span className={styles.remotesTitle}>
          {t('monitorMap.browserScreens')}
        </span>

        {remoteScreens.map((screen) => (
          <button
            key={screen.name}
            type="button"
            className={cx(
              styles.chip,
              editorUi.focusedMonitorName === screen.name && styles.chipSelected
            )}
            onClick={() => editorUi.focusMonitor(screen.name)}
          >
            <Tablet size={14} />
            <span className={styles.chipLabel}>
              {screen.name} · {screen.bounds.width}×{screen.bounds.height}
            </span>
          </button>
        ))}

        <AddRemoteScreenButton />
      </div>
    </section>
  );
});

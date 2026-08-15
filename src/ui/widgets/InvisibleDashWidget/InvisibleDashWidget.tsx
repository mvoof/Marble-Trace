import { observer } from 'mobx-react-lite';

import type { InvisibleDashWidgetSettings } from '@/types/widget-settings';
import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { useWidgetSettingsStore } from '@store/root-store-context';

import { EngineCluster } from './EngineCluster/EngineCluster';
import { GearReadout } from './GearReadout/GearReadout';
import { RaceCluster } from './RaceCluster/RaceCluster';
import { INVISIBLE_DASH_MANIFEST } from './manifest';
import {
  computeBackdrop,
  computeBloom,
  computeDepthTransform,
} from './invisible-dash-utils';

import styles from './InvisibleDashWidget.module.scss';

export const InvisibleDashWidget = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<InvisibleDashWidgetSettings>('invisible-dash');

  const isProjection = settings.renderMode === 'projection';
  const { transform, opacity, scale } = computeDepthTransform(settings.depth);
  // The readout is sized off the height (scaleFromHeight), and so is the glow —
  // a halo keyed to the width would swell every time the dash was stretched.
  const readoutScale =
    settings.currentHeight / INVISIBLE_DASH_MANIFEST.designHeight;
  const bloom = isProjection
    ? computeBloom(
        settings.projectionTint,
        settings.bloomIntensity,
        readoutScale
      )
    : 'none';
  const backdrop = computeBackdrop(settings.backdropColor);
  const isFullBackdrop = settings.backdropScope === 'full';

  return (
    <WidgetPanel
      className={`${styles.root} ${isProjection ? styles.projection : styles.contour}`}
      minWidth={0}
      gap={0}
      direction="row"
    >
      <div className={styles.stage}>
        <div
          className={`${styles.strip} ${isFullBackdrop ? styles.stripFilled : ''}`}
          style={{
            transform,
            opacity,
            textShadow: bloom,
            color: settings.textColor,
            ['--idash-scale' as string]: scale,
            ...(isFullBackdrop ? backdrop : null),
          }}
        >
          <div
            className={styles.cluster}
            style={isFullBackdrop ? undefined : backdrop}
          >
            <EngineCluster />

            {settings.showGear && (settings.showSpeed || settings.showRpm) && (
              <span className={styles.separator} />
            )}

            <GearReadout />
          </div>

          <RaceCluster backdrop={isFullBackdrop ? undefined : backdrop} />
        </div>
      </div>
    </WidgetPanel>
  );
});

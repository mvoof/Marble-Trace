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
  computeCurvature,
  computeDepthTransform,
  curvatureInset,
} from './invisible-dash-utils';

import { useStripFit } from './use-strip-fit';

import styles from './InvisibleDashWidget.module.scss';

export const InvisibleDashWidget = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const { stripRef, fit } = useStripFit();

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
  const isFullBackdrop = settings.backdropScope === 'full';
  const backdrop = computeBackdrop(settings.backdropColor);
  const leftCurve = computeCurvature(settings.curvature, 'left');
  const rightCurve = computeCurvature(settings.curvature, 'right');
  const curveInset = curvatureInset(settings.curvature);

  return (
    <WidgetPanel
      className={`${styles.root} ${isProjection ? styles.projection : styles.contour}`}
      minWidth={0}
      gap={0}
      direction="row"
    >
      <div className={styles.stage}>
        <div
          ref={stripRef}
          className={styles.strip}
          style={{
            transform: `translate(-50%, -50%) scale(${fit}) ${transform}`,
            opacity,
            textShadow: bloom,
            color: settings.textColor,
            ['--idash-scale' as string]: scale * fit,
            ...(isFullBackdrop ? backdrop : null),
            // Applied in both modes: the curve needs the same room whichever
            // box is painted, and room that appeared with the paint would shift
            // the digits on every switch.
            ...curveInset,
          }}
        >
          <div
            className={styles.cluster}
            style={{ ...(isFullBackdrop ? undefined : backdrop), ...leftCurve }}
          >
            <EngineCluster />

            {settings.showGear && (settings.showSpeed || settings.showRpm) && (
              <span className={styles.separator} />
            )}

            <GearReadout />
          </div>

          <RaceCluster
            backdrop={isFullBackdrop ? undefined : backdrop}
            curve={rightCurve}
          />
        </div>
      </div>
    </WidgetPanel>
  );
});

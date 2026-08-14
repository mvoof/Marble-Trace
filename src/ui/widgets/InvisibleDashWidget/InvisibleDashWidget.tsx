import { observer } from 'mobx-react-lite';

import type { InvisibleDashWidgetSettings } from '@/types/widget-settings';
import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { useWidgetSettingsStore } from '@store/root-store-context';

import { EngineCluster } from './EngineCluster/EngineCluster';
import { GearReadout } from './GearReadout/GearReadout';
import { RaceCluster } from './RaceCluster/RaceCluster';
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
  const { transform, opacity } = computeDepthTransform(settings.depth);
  const bloom = isProjection
    ? computeBloom(settings.projectionTint, settings.bloomIntensity)
    : 'none';
  const backdrop = computeBackdrop(settings.backdropColor);

  return (
    <WidgetPanel
      className={`${styles.root} ${isProjection ? styles.projection : styles.contour}`}
      minWidth={0}
      gap={0}
      direction="row"
    >
      <div className={styles.stage}>
        <div
          className={styles.strip}
          style={{
            transform,
            opacity,
            textShadow: bloom,
            color: settings.textColor,
          }}
        >
          <div className={styles.cluster} style={backdrop}>
            <EngineCluster />

            {settings.showGear && (settings.showSpeed || settings.showRpm) && (
              <span className={styles.separator} />
            )}

            <GearReadout />
          </div>

          <RaceCluster backdrop={backdrop} />
        </div>
      </div>
    </WidgetPanel>
  );
});

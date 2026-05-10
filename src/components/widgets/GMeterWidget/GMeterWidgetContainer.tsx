import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { autorun } from 'mobx';

import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { GMeterWidget, type GMeterHandle } from './GMeterWidget';
import { G_CONSTANT } from './g-meter-utils';

export const GMeterWidgetContainer = observer(() => {
  const { displayMode, scale, colorMode } =
    widgetSettingsStore.getGMeterSettings();

  const gMeterRef = useRef<GMeterHandle>(null);

  useEffect(() => {
    return autorun(() => {
      const dynamics = telemetryStore.carDynamics;
      const latAccel = dynamics?.lat_accel ?? null;
      const lonAccel = dynamics?.long_accel ?? null;

      const rawLat = latAccel != null ? latAccel / G_CONSTANT : 0;
      const rawLon = lonAccel != null ? lonAccel / G_CONSTANT : 0;

      gMeterRef.current?.update(rawLat, rawLon);
    });
  }, []);

  return (
    <GMeterWidget
      ref={gMeterRef}
      displayMode={displayMode}
      scale={scale}
      colorMode={colorMode}
    />
  );
});

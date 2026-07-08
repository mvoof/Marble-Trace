import type React from 'react';
import { observer } from 'mobx-react-lite';

import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { computeRpmZoneState, rpmFillColor } from '../race-dash-utils';
import {
  usePlayerStore,
  useSessionStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import styles from './RpmFill.module.scss';

export const RpmFill = observer(() => {
  const { carDynamics, carStatus } = usePlayerStore();
  const { sessionInfo } = useSessionStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');

  const rpm = carDynamics?.rpm ?? 0;
  const { pct, zone } = computeRpmZoneState(rpm, sessionInfo, carStatus);
  const isBlink = zone === 'blink';

  return (
    <div
      className={`${styles.fill} ${isBlink ? styles.blink : ''}`}
      style={
        {
          height: `${Math.round(pct * 100)}%`,
          '--rpm-fill-color': rpmFillColor(zone, settings),
        } as React.CSSProperties
      }
    />
  );
});

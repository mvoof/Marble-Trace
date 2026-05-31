import { useRef } from 'react';
import { observer } from 'mobx-react-lite';
import type { TelemetryStore } from '@store/iracing/telemetry.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import type { InputTraceSettings } from '@/types/widget-settings';

import styles from './Bar.module.scss';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

type BarChannel = 'throttle' | 'brake' | 'clutch';
type BarWidth = 'sm' | 'md' | 'lg';

interface BarProps {
  channel: BarChannel;
  width?: BarWidth;
  rounded?: boolean;
}

const getRawValue = (
  telemetry: TelemetryStore,
  channel: BarChannel
): number => {
  const frame = telemetry.carInputs;

  if (channel === 'throttle') return frame?.throttle ?? 0;
  if (channel === 'brake') return frame?.brake ?? 0;

  return frame?.clutch != null ? 1 - frame.clutch : 0;
};

const getChannelColor = (
  widgetSettings: WidgetSettingsStore,
  channel: BarChannel
): string => {
  const settings =
    widgetSettings.getSettings<InputTraceSettings>('input-trace');

  if (channel === 'throttle') return settings.throttleColor;
  if (channel === 'brake') return settings.brakeColor;

  return settings.clutchColor;
};

const CHANNEL_VISIBILITY_KEY: Record<
  BarChannel,
  'showClutch' | 'showBrake' | 'showThrottle'
> = {
  clutch: 'showClutch',
  brake: 'showBrake',
  throttle: 'showThrottle',
};

export const Bar = observer(
  ({ channel, width = 'md', rounded = true }: BarProps) => {
    const telemetry = useTelemetryStore();
    const widgetSettings = useWidgetSettingsStore();
    const settings =
      widgetSettings.getSettings<InputTraceSettings>('input-trace');
    const smoothedRef = useRef(0);

    if (!settings[CHANNEL_VISIBILITY_KEY[channel]]) {
      return null;
    }

    const rawValue = getRawValue(telemetry, channel);
    const smoothing = settings.smoothing;

    if (smoothing <= 0) {
      smoothedRef.current = rawValue;
    } else {
      smoothedRef.current =
        (smoothedRef.current * smoothing + rawValue) / (smoothing + 1);
    }

    const clamped = Math.max(0, Math.min(1, smoothedRef.current));
    const isAbsActive =
      channel === 'brake' && (telemetry.carInputs?.brake_abs_active ?? false);

    const color = isAbsActive
      ? settings.absColor
      : getChannelColor(widgetSettings, channel);

    return (
      <div className={styles.verticalContainer}>
        <div
          className={`${styles.verticalTrack} ${styles[`trackWidth-${width}`]}${
            !rounded ? ` ${styles.noRadius}` : ''
          }`}
        >
          <div
            className={`${styles.verticalFill}${!rounded ? ` ${styles.noRadius}` : ''}`}
            style={{ height: `${clamped * 100}%`, background: color }}
          />
        </div>
      </div>
    );
  }
);

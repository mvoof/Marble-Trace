import { useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { widgetSettingsStore } from '@store/widget-settings.store';

import styles from './Bar.module.scss';

type BarChannel = 'throttle' | 'brake' | 'clutch';
type BarWidth = 'sm' | 'md' | 'lg';

interface BarProps {
  channel: BarChannel;
  width?: BarWidth;
  rounded?: boolean;
}

function getRawValue(channel: BarChannel): number {
  const frame = telemetryStore.carInputs;

  if (channel === 'throttle') return frame?.throttle ?? 0;
  if (channel === 'brake') return frame?.brake ?? 0;

  return frame?.clutch != null ? 1 - frame.clutch : 0;
}

function getChannelColor(channel: BarChannel): string {
  const settings = widgetSettingsStore.getInputTraceSettings();

  if (channel === 'throttle') return settings.throttleColor;
  if (channel === 'brake') return settings.brakeColor;

  return settings.clutchColor;
}

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
    const settings = widgetSettingsStore.getInputTraceSettings();
    const smoothedRef = useRef(0);

    if (!settings[CHANNEL_VISIBILITY_KEY[channel]]) {
      return null;
    }

    const rawValue = getRawValue(channel);
    const smoothing = settings.smoothing;

    if (smoothing <= 0) {
      smoothedRef.current = rawValue;
    } else {
      smoothedRef.current =
        (smoothedRef.current * smoothing + rawValue) / (smoothing + 1);
    }

    const clamped = Math.max(0, Math.min(1, smoothedRef.current));
    const color = getChannelColor(channel);

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

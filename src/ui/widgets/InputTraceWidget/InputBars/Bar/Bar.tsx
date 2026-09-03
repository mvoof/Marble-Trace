import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { useRef } from 'react';
import { observer } from 'mobx-react-lite';
import type { InputTraceSettings } from '@/types/widget-settings';

import { getContrastTextColor } from '@utils/colors';

import { useValueCoverPoint } from './useValueCoverPoint';

import styles from './Bar.module.scss';
import {
  useInputTraceWidgetStore,
  usePlayerStore,
} from '@store/root-store-context';
import type { InputChannel } from '@ui/widgets/InputTraceWidget/input-trace.widget';

type BarChannel = InputChannel;
type BarWidth = 'sm' | 'md' | 'lg';

interface BarProps {
  channel: BarChannel;
  width?: BarWidth;
  rounded?: boolean;
}

const getChannelColor = (
  settings: InputTraceSettings,
  channel: BarChannel
): string => {
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
    const trackRef = useRef<HTMLDivElement>(null);
    const labelRef = useRef<HTMLSpanElement>(null);
    const { carInputs } = usePlayerStore();
    const inputTrace = useInputTraceWidgetStore();
    const settings = useWidgetSettings<InputTraceSettings>('input-trace');
    const showValue = settings.showInputValues;
    const coverPoint = useValueCoverPoint(trackRef, labelRef, showValue);

    if (!settings[CHANNEL_VISIBILITY_KEY[channel]]) {
      return null;
    }

    const clamped = Math.max(0, Math.min(1, inputTrace.smoothed[channel]));
    const isAbsActive =
      channel === 'brake' && (carInputs?.brake_abs_active ?? false);

    const valueText = `${Math.round(clamped * 100)}`;

    const color = isAbsActive
      ? settings.absColor
      : getChannelColor(settings, channel);

    return (
      <div className={styles.verticalContainer}>
        <div
          ref={trackRef}
          className={`${styles.verticalTrack} ${styles[`trackWidth-${width}`]}${
            !rounded ? ` ${styles.noRadius}` : ''
          }`}
        >
          <div
            className={`${styles.verticalFill}${!rounded ? ` ${styles.noRadius}` : ''}`}
            style={{ height: `${clamped * 100}%`, background: color }}
          />
        </div>

        {showValue && (
          <span
            ref={labelRef}
            className={styles.value}
            style={{
              color:
                clamped >= coverPoint ? getContrastTextColor(color) : undefined,
            }}
          >
            {valueText}
          </span>
        )}
      </div>
    );
  }
);

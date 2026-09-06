import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { useRef } from 'react';
import { observer } from 'mobx-react-lite';
import type { InputTraceSettings } from '@/types/widget-settings';

import { getContrastTextColor } from '@utils/colors';

import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
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

const FILL_HEIGHT_PROPERTY = '--bar-fill';
const FILL_COLOR_PROPERTY = '--bar-color';
const VALUE_COLOR_PROPERTY = '--bar-value-color';

const PCT = 100;

const CHANNEL_VISIBILITY_KEY: Record<
  BarChannel,
  'showClutch' | 'showBrake' | 'showThrottle'
> = {
  clutch: 'showClutch',
  brake: 'showBrake',
  throttle: 'showThrottle',
};

/**
 * One pedal's bar. The pedal moves on every physics tick, so its height, its
 * colour and its readout are written straight to the DOM and React renders the
 * bar only when the driver changes a setting. See `docs/rendering.md`.
 */
export const Bar = observer(function Bar({
  channel,
  width = 'md',
  rounded = true,
}: BarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const player = usePlayerStore();
  const inputTrace = useInputTraceWidgetStore();
  const settings = useWidgetSettings<InputTraceSettings>('input-trace');
  const showValue = settings.showInputValues;
  const coverPoint = useValueCoverPoint(trackRef, labelRef, showValue);

  const containerRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      const clamped = Math.max(0, Math.min(1, inputTrace.smoothed[channel]));
      const isAbsActive = channel === 'brake' && player.isAbsActive;

      const color = isAbsActive
        ? settings.absColor
        : getChannelColor(settings, channel);

      const valueText = `${Math.round(clamped * PCT)}`;
      const valueColor =
        clamped >= coverPoint ? getContrastTextColor(color) : '';

      scheduleWrite(() => {
        element.style.setProperty(FILL_HEIGHT_PROPERTY, `${clamped * PCT}%`);
        element.style.setProperty(FILL_COLOR_PROPERTY, color);
        element.style.setProperty(VALUE_COLOR_PROPERTY, valueColor);

        const label = element.querySelector(`.${styles.value}`);

        if (label instanceof HTMLElement) {
          label.textContent = valueText;
        }
      });
    },
    [inputTrace, player, settings, channel, coverPoint]
  );

  if (!settings[CHANNEL_VISIBILITY_KEY[channel]]) {
    return null;
  }

  return (
    <div ref={containerRef} className={styles.verticalContainer}>
      <div
        ref={trackRef}
        className={`${styles.verticalTrack} ${styles[`trackWidth-${width}`]}${
          !rounded ? ` ${styles.noRadius}` : ''
        }`}
      >
        <div
          className={`${styles.verticalFill}${!rounded ? ` ${styles.noRadius}` : ''}`}
        />
      </div>

      {showValue && <span ref={labelRef} className={styles.value} />}
    </div>
  );
});

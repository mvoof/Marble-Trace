import { observer } from 'mobx-react-lite';
import type { WidgetSettingsStore } from '@store/settings/widget-settings.store';
import type { InputTraceSettings } from '@/types/widget-settings';

import styles from './Bar.module.scss';
import {
  useInputTraceWidgetStore,
  usePlayerStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { InputChannel } from '@widgets/InputTraceWidget/input-trace.widget';

type BarChannel = InputChannel;
type BarWidth = 'sm' | 'md' | 'lg';

interface BarProps {
  channel: BarChannel;
  width?: BarWidth;
  rounded?: boolean;
}

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
    const { carInputs } = usePlayerStore();
    const widgetSettings = useWidgetSettingsStore();
    const inputTrace = useInputTraceWidgetStore();
    const settings =
      widgetSettings.getSettings<InputTraceSettings>('input-trace');

    if (!settings[CHANNEL_VISIBILITY_KEY[channel]]) {
      return null;
    }

    const clamped = Math.max(0, Math.min(1, inputTrace.smoothed[channel]));
    const isAbsActive =
      channel === 'brake' && (carInputs?.brake_abs_active ?? false);

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

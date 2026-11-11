import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { useLiveParts, writeStyle } from '@shared/ui/live/live-parts';

import styles from './Bar.module.scss';
import { usePlayerStore } from '@entities/player/player-context';
import { useInputTraceWidgetStore } from '@widgets/input-trace/input-trace.store';
import type { InputChannel } from '@widgets/input-trace/input-trace.store';
import type { InputTraceSettings } from '../../settings-schema';

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
const MIN_STOP_COLOR_PROPERTY = '--bar-min-color';
const MAX_STOP_COLOR_PROPERTY = '--bar-max-color';

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
export const Bar = observer(
  ({ channel, width = 'md', rounded = true }: BarProps) => {
    const player = usePlayerStore();
    const inputTrace = useInputTraceWidgetStore();
    const settings = useWidgetSettings<InputTraceSettings>('input-trace');
    const showValue = settings.showInputValues;

    const parts = useLiveParts<'value'>();

    const containerRef = useReactiveDomWrite<HTMLDivElement>(
      (element, scheduleWrite) => {
        const clamped = Math.max(0, Math.min(1, inputTrace.smoothed[channel]));
        const isAbsActive =
          channel === 'brake' && settings.showAbs && player.isAbsActive;

        const color = isAbsActive
          ? settings.absColor
          : getChannelColor(settings, channel);

        // The stops follow the readout: lit from the first percent the
        // pedal shows, and on top at the hundred it shows.
        const percent = Math.round(clamped * PCT);
        const valueText = `${percent}`;
        const minColor = percent > 0 ? color : '';
        const maxColor = percent >= PCT ? color : '';

        scheduleWrite(() => {
          writeStyle(element, FILL_HEIGHT_PROPERTY, `${clamped * PCT}%`);
          writeStyle(element, FILL_COLOR_PROPERTY, color);
          writeStyle(element, MIN_STOP_COLOR_PROPERTY, minColor || null);
          writeStyle(element, MAX_STOP_COLOR_PROPERTY, maxColor || null);
          parts.text('value', valueText);
        });
      },
      [inputTrace, player, settings, channel, showValue, parts]
    );

    if (!settings[CHANNEL_VISIBILITY_KEY[channel]]) {
      return null;
    }

    const radiusClass = rounded ? '' : ` ${styles.noRadius}`;

    return (
      <div ref={containerRef} className={styles.verticalContainer}>
        {showValue && (
          <span ref={parts.ref('value')} className={styles.value} />
        )}

        <div
          className={`${styles.verticalTrack} ${styles[`trackWidth-${width}`]}`}
        >
          <div className={`${styles.stop} ${styles.maxStop}${radiusClass}`} />

          <div className={`${styles.well}${radiusClass}`}>
            <div className={`${styles.verticalFill}${radiusClass}`} />
          </div>

          <div className={`${styles.stop} ${styles.minStop}${radiusClass}`} />
        </div>
      </div>
    );
  }
);

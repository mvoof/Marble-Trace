import { observer } from 'mobx-react-lite';

import type { RpmLightsWidgetSettings } from '@/types/widget-settings';
import { computeShiftThresholds, rpmZoneColorByPct } from '@utils/car-signals';
import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { usePlayerStore, useSessionStore } from '@store/root-store-context';

import {
  LED_COLOR_PROPERTY,
  LED_COUNT,
  LED_OFF,
  ledShapeStyle,
} from '../led-shape';
import styles from '../RpmLightsWidget.module.scss';

/**
 * The racing bar: twenty-two LEDs whose colours follow the engine's revs, a hot
 * field that changes on every physics tick. The LEDs themselves are markup React
 * writes once; the revs reach them through the reactive-DOM primitive, one pass
 * over the row per animation frame, so a full-throttle burst wakes React not at
 * all. See `docs/rendering.md`.
 */
export const RpmBar = observer(function RpmBar() {
  const player = usePlayerStore();
  const sessionStore = useSessionStore();
  const settings = useWidgetSettings<RpmLightsWidgetSettings>('rpm-lights');

  const barRef = useReactiveDomWrite<HTMLElement>(
    (element, scheduleWrite) => {
      const colors = {
        low: settings.rpmColorLow,
        mid: settings.rpmColorMid,
        high: settings.rpmColorHigh,
        shift: settings.rpmColorShift,
        limit: settings.rpmColorLimit,
      };

      const rpm = player.carDynamics?.rpm ?? 0;
      const { shiftRpm, blinkRpm } = computeShiftThresholds(
        sessionStore.sessionInfo,
        player.carStatus,
        player.carDynamics?.gear ?? 0
      );

      const isShift = rpm >= shiftRpm;
      const isBlink = rpm >= blinkRpm;

      const displayPct = Math.min(Math.max(rpm / (blinkRpm || 1), 0), 1);
      const litCount = isShift ? LED_COUNT : Math.floor(displayPct * LED_COUNT);

      const ledColors = Array.from({ length: LED_COUNT }, (_unused, index) => {
        if (index >= litCount) {
          return null;
        }

        if (isBlink) {
          return colors.limit;
        }

        if (isShift) {
          return colors.shift;
        }

        return rpmZoneColorByPct((index + 1) / LED_COUNT, colors);
      });

      scheduleWrite(() => {
        element.classList.toggle(styles.barBlink, isShift);

        for (const [index, color] of ledColors.entries()) {
          const led = element.children[index];

          if (!(led instanceof HTMLElement)) {
            continue;
          }

          led.classList.toggle(styles.segLit, color !== null);
          led.style.setProperty(LED_COLOR_PROPERTY, color ?? LED_OFF);
        }
      });
    },
    [player, sessionStore, settings]
  );

  const ledStyle = ledShapeStyle(settings.ledShape);

  return (
    <WidgetPanel
      ref={barRef}
      direction="row"
      style={{ gap: undefined }}
      className={styles.bar}
    >
      {Array.from({ length: LED_COUNT }, (_unused, index) => (
        <div key={`led-${index}`} className={styles.seg} style={ledStyle} />
      ))}
    </WidgetPanel>
  );
});

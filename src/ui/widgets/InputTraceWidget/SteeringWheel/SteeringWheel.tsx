import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import type { CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';
import { usePlayerStore, useUnitsStore } from '@store/root-store-context';
import type { InputTraceSettings } from '@/types/widget-settings';
import { steeringAngleDeg } from '@utils/car-signals';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import Logo from '@assets/logo.svg?react';
import { getWheelArt } from './WheelArt';
import styles from './SteeringWheel.module.scss';

/** The custom property the wheel turns on; both rotators rotate by it in CSS. */
const STEERING_ANGLE_PROPERTY = '--steering-angle';

const MARKER_COLOR_PROPERTY = '--steering-marker-color';

const NEUTRAL_GEAR_LABEL = 'N';
const REVERSE_GEAR_LABEL = 'R';

const gearLabelOf = (gear: number): string => {
  if (gear === 0) {
    return NEUTRAL_GEAR_LABEL;
  }

  if (gear === -1) {
    return REVERSE_GEAR_LABEL;
  }

  return String(gear);
};

/**
 * What the wheel's hub reads: the gear, the speed, the steering angle, or the
 * logo. Every one of them but the logo moves on every physics tick, so the
 * markup is rendered once per display mode and the numbers are written into it.
 * See `docs/rendering.md`.
 */
const WheelCenter = observer(() => {
  const telemetry = usePlayerStore();
  const units = useUnitsStore();

  const settings = useWidgetSettings<InputTraceSettings>('input-trace');
  const display = settings.steeringCenterDisplay;

  const centerRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      const carDynamics = telemetry.carDynamics;

      const text = (() => {
        if (display === 'gear') {
          return gearLabelOf(carDynamics?.gear ?? 0);
        }

        if (display === 'speed') {
          return Math.round(
            (carDynamics?.speed ?? 0) * units.speedFactor
          ).toString();
        }

        return Math.round(
          steeringAngleDeg(carDynamics?.steering_wheel_angle ?? 0)
        ).toString();
      })();

      const speedText = Math.round(
        (carDynamics?.speed ?? 0) * units.speedFactor
      ).toString();
      const gearText = gearLabelOf(carDynamics?.gear ?? 0);

      scheduleWrite(() => {
        if (display === 'speed-gear') {
          const speed = element.querySelector(`.${styles.speedGearSpeed}`);
          const gear = element.querySelector(`.${styles.speedGearGear}`);

          if (speed instanceof HTMLElement) {
            speed.textContent = speedText;
          }

          if (gear instanceof HTMLElement) {
            gear.textContent = gearText;
          }

          return;
        }

        if (display === 'angle') {
          const number = element.querySelector(`.${styles.centerNum}`);

          if (number instanceof HTMLElement) {
            number.textContent = text;
          }

          return;
        }

        element.textContent = text;
      });
    },
    [telemetry, units, display]
  );

  if (display === 'none') {
    return null;
  }

  if (display === 'gear' || display === 'speed') {
    return <span ref={centerRef} className={styles.centerText} />;
  }

  if (display === 'angle') {
    return (
      <span
        ref={centerRef}
        className={`${styles.centerText} ${styles.centerAngle}`}
      >
        <span className={styles.centerNum} />
        <span className={styles.centerUnit}>°</span>
      </span>
    );
  }

  if (display === 'speed-gear') {
    return (
      <span ref={centerRef} className={styles.speedGear}>
        <span className={styles.speedGearSpeed} />
        <span className={styles.speedGearDivider} />
        <span className={styles.speedGearGear} />
      </span>
    );
  }

  return (
    <div className={styles.logoWrapper}>
      <Logo className={styles.logo} />
    </div>
  );
});

/**
 * The wheel itself. The steering angle changes on every physics tick and turns
 * one element, which is exactly the case the reactive-DOM primitive is for: the
 * rim, the marker and the traced art are the same element objects for as long as
 * the wheel is mounted.
 */
export const SteeringWheel = observer(() => {
  const telemetry = usePlayerStore();

  const settings = useWidgetSettings<InputTraceSettings>('input-trace');
  const WheelArt = getWheelArt(settings.steeringWheelStyle);

  const rotatorRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      const rawAngle = telemetry.carDynamics?.steering_wheel_angle ?? 0;

      scheduleWrite(() => {
        element.style.setProperty(STEERING_ANGLE_PROPERTY, `${-rawAngle}rad`);
      });
    },
    [telemetry, settings.steeringWheelStyle, settings.showSteering]
  );

  if (!settings.showSteering) {
    return null;
  }

  // A traced wheel turns as a whole, so it replaces both the groove it would
  // hide and the rim marker it already reads as — gt-round and flat-bottom
  // are radially symmetric enough that the marker is drawn into their own
  // SVG instead (see wheels/gt-round.svg, wheels/flat-bottom-wheel.svg).
  if (WheelArt) {
    return (
      <div className={styles.container}>
        <div className={styles.dial}>
          <div
            ref={rotatorRef}
            className={styles.artRotator}
            style={
              {
                [MARKER_COLOR_PROPERTY]: settings.steeringMarkerColor,
              } as CSSProperties
            }
          >
            <WheelArt className={styles.art} />
          </div>

          {settings.steeringCenterDisplay !== 'none' && (
            <div
              className={
                settings.steeringCenterPlate
                  ? `${styles.artCenter} ${styles.artCenterPlate}`
                  : styles.artCenter
              }
            >
              <WheelCenter />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.dial}>
        <div className={styles.groove} />

        <div ref={rotatorRef} className={styles.rotator}>
          <div className={styles.indicatorMarker} />
        </div>

        <div className={styles.centerPad}>
          <WheelCenter />
        </div>
      </div>
    </div>
  );
});

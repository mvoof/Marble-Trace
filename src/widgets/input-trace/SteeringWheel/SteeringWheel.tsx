import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { useState, type CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';
import { usePlayerStore } from '@entities/player/player-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { steeringAngleDeg } from '@shared/lib/car-signals';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { formatGear } from '@shared/lib/telemetry-format';
import {
  useLiveParts,
  writeStyle,
  writeText,
} from '@shared/ui/live/live-parts';
import Logo from '@assets/brand-mark.svg?react';
import { getWheelArt } from './WheelArt';
import { useInputTraceWidgetStore } from '../input-trace.store';
import styles from './SteeringWheel.module.scss';
import type { InputTraceSettings } from '../settings-schema';

/** The custom property the wheel turns on; both rotators rotate by it in CSS. */
const STEERING_ANGLE_PROPERTY = '--steering-angle';

const MARKER_COLOR_PROPERTY = '--steering-marker-color';

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
  const parts = useLiveParts<'number' | 'speed' | 'gear'>();

  const centerRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      const carDynamics = telemetry.carDynamics;

      const text = (() => {
        if (display === 'gear') {
          return formatGear(carDynamics?.gear ?? 0);
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
      const gearText = formatGear(carDynamics?.gear ?? 0);

      scheduleWrite(() => {
        if (display === 'speed-gear') {
          parts.text('speed', speedText);
          parts.text('gear', gearText);

          return;
        }

        if (display === 'angle') {
          parts.text('number', text);

          return;
        }

        writeText(element, text);
      });
    },
    [telemetry, units, display, parts]
  );

  if (display === 'none') {
    return null;
  }

  if (display === 'gear' || display === 'speed') {
    return <span key={display} ref={centerRef} className={styles.centerText} />;
  }

  if (display === 'angle') {
    return (
      <span
        key={display}
        ref={centerRef}
        className={`${styles.centerText} ${styles.centerAngle}`}
      >
        <span ref={parts.ref('number')} className={styles.centerNum} />
        <span className={styles.centerUnit}>°</span>
      </span>
    );
  }

  if (display === 'speed-gear') {
    return (
      <span key={display} ref={centerRef} className={styles.speedGear}>
        <span ref={parts.ref('speed')} className={styles.speedGearSpeed} />
        <span className={styles.speedGearDivider} />
        <span ref={parts.ref('gear')} className={styles.speedGearGear} />
      </span>
    );
  }

  return (
    <div key={display} className={styles.logoWrapper}>
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
  const inputTrace = useInputTraceWidgetStore();
  const WheelArt = getWheelArt(settings.steeringWheelStyle);

  // A file deleted from disk after it was picked would show the webview's
  // broken-image icon; the drawn dial stands in for it instead.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const customSrc =
    settings.steeringWheelStyle === 'custom' &&
    inputTrace.customWheelSrc !== failedSrc
      ? inputTrace.customWheelSrc
      : null;

  const rotatorRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      const rawAngle = telemetry.carDynamics?.steering_wheel_angle ?? 0;

      scheduleWrite(() => {
        writeStyle(element, STEERING_ANGLE_PROPERTY, `${-rawAngle}rad`);
      });
    },
    [telemetry, settings.steeringWheelStyle, settings.showSteering, customSrc]
  );

  if (!settings.showSteering) {
    return null;
  }

  // A traced wheel turns as a whole, so it replaces both the groove it would
  // hide and the rim marker it already reads as — gt-round and flat-bottom
  // are radially symmetric enough that the marker is drawn into their own
  // SVG instead (see wheels/gt-round.svg, wheels/flat-bottom-wheel.svg). The
  // user's own picture turns the same way, as it is.
  if (WheelArt || customSrc) {
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
            {customSrc ? (
              <img
                src={customSrc}
                alt=""
                draggable={false}
                className={styles.customArt}
                onError={() => setFailedSrc(customSrc)}
              />
            ) : (
              WheelArt && <WheelArt className={styles.art} />
            )}
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

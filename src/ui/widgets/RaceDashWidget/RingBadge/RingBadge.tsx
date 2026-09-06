import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';

import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { formatGear } from '@utils/telemetry-format';
import { computeShiftThresholds } from '@utils/car-signals';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import {
  computeRpmZoneState,
  rpmFillColor,
  rpmNumberColor,
} from '../race-dash-utils';
import { usePlayerStore, useSessionStore } from '@store/root-store-context';
import { RpmComb } from '../RpmComb/RpmComb';
import { SteeringMarker } from '../SteeringMarker/SteeringMarker';
import { ARC_SWEEP_DEG, RING_SIZE, ringArcPath } from './ring-geometry';

import styles from './RingBadge.module.scss';

const MIN_VISIBLE_ARC_DEG = 0.5;
const SHIFT_FLASH_MS = 220;

const GLOW_COLOR_PROPERTY = '--core-glow-color';
const GLOW_SCALE_PROPERTY = '--core-glow-scale';
const GEAR_COLOR_PROPERTY = '--ring-gear-color';

const hidePath = (path: SVGPathElement, d: string, isVisible: boolean) => {
  path.setAttribute('d', isVisible ? d : '');
  path.style.display = isVisible ? '' : 'none';
};

/**
 * The rev ring and the gear inside it. Everything it draws follows the revs,
 * which change on every physics tick, so the arcs, the glow and the digit are
 * written straight to the DOM and React renders the badge once per setting
 * change. See `docs/rendering.md`.
 */
export const RingBadge = observer(function RingBadge() {
  const player = usePlayerStore();
  const sessionStore = useSessionStore();

  const settings = useWidgetSettings<RaceDashWidgetSettings>('race-dash');

  const showFill = settings.rpmIndicatorMode === 'fill';
  const showComb = settings.rpmIndicatorMode === 'comb';
  const showGlow = settings.rpmIndicatorMode === 'glow';

  const gear = player.currentGear;

  // A short pulse ring the instant the driver upshifts, on top of the
  // continuous core glow — the "shift landed" confirmation.
  const previousGearRef = useRef(gear);
  const [showShiftFlash, setShowShiftFlash] = useState(false);

  useEffect(() => {
    if (
      showGlow &&
      gear > previousGearRef.current &&
      previousGearRef.current > 0
    ) {
      setShowShiftFlash(true);
      const timeout = setTimeout(
        () => setShowShiftFlash(false),
        SHIFT_FLASH_MS
      );

      previousGearRef.current = gear;

      return () => clearTimeout(timeout);
    }

    previousGearRef.current = gear;
  }, [gear, showGlow]);

  const rootRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      const currentGear = player.carDynamics?.gear ?? 0;
      const rpm = player.carDynamics?.rpm ?? 0;
      const sessionInfo = sessionStore.sessionInfo;
      const carStatus = player.carStatus;

      const { pct, zone } = computeRpmZoneState(
        rpm,
        sessionInfo,
        carStatus,
        currentGear
      );
      const { shiftRpm, blinkRpm, redLine } = computeShiftThresholds(
        sessionInfo,
        carStatus,
        currentGear
      );

      // Printed bands sit on the same 0..redline scale as the fill arc, and
      // their boundaries are the very thresholds that switch the fill color:
      // shift RPM opens the amber band, blink RPM opens the redline band. The
      // moment the fill crosses a printed edge is the moment the zone changes
      // — no text needed.
      const degForRpm = (value: number) =>
        Math.min(Math.max(value / (redLine || 1), 0), 1) * ARC_SWEEP_DEG;

      const shiftStartDeg = degForRpm(shiftRpm);
      const blinkStartDeg = Math.max(degForRpm(blinkRpm), shiftStartDeg);
      const fillDeg = pct * ARC_SWEEP_DEG;

      const fillColor = rpmFillColor(zone, settings);
      const isBlink = zone === 'blink';

      // When neither ring scale is shown, the gear digit stays white — the core
      // glow already carries the zone color, so tinting the digit too would
      // wash the two together.
      const gearColor =
        showFill || showComb ? rpmNumberColor(zone, settings) : null;

      // Grows from a small dot at the center out to the full circle by the time
      // rpm hits the shift point — same zone colors as the fill arc, just as a
      // filled disc instead of a ring.
      const coreGlowScale = isBlink
        ? 1
        : Math.min(Math.max(rpm / (shiftRpm || 1), 0), 1);

      const gearText = formatGear(currentGear);

      scheduleWrite(() => {
        const dim = element.querySelector(`.${styles.trackDim}`);
        const shift = element.querySelector(`.${styles.trackShift}`);
        const redline = element.querySelector(`.${styles.trackRedline}`);
        const fill = element.querySelector(`.${styles.fillArc}`);

        if (dim instanceof SVGPathElement) {
          hidePath(
            dim,
            ringArcPath(0, shiftStartDeg),
            shiftStartDeg > MIN_VISIBLE_ARC_DEG
          );
        }

        if (shift instanceof SVGPathElement) {
          hidePath(
            shift,
            ringArcPath(shiftStartDeg, blinkStartDeg),
            blinkStartDeg - shiftStartDeg > MIN_VISIBLE_ARC_DEG
          );
        }

        if (redline instanceof SVGPathElement) {
          hidePath(
            redline,
            ringArcPath(blinkStartDeg, ARC_SWEEP_DEG),
            blinkStartDeg < ARC_SWEEP_DEG - MIN_VISIBLE_ARC_DEG
          );
        }

        if (fill instanceof SVGPathElement) {
          hidePath(
            fill,
            ringArcPath(0, fillDeg),
            fillDeg > MIN_VISIBLE_ARC_DEG
          );
          fill.style.stroke = fillColor;
        }

        const glow = element.querySelector(`.${styles.coreGlow}`);

        if (glow instanceof HTMLElement) {
          glow.classList.toggle(styles.coreGlowBlink, isBlink);
          glow.style.setProperty(GLOW_COLOR_PROPERTY, fillColor);
          glow.style.setProperty(GLOW_SCALE_PROPERTY, String(coreGlowScale));
        }

        const gearDigit = element.querySelector(`.${styles.gear}`);

        if (gearDigit instanceof HTMLElement) {
          gearDigit.classList.toggle(styles.blinkPulse, isBlink);
          gearDigit.style.setProperty(GEAR_COLOR_PROPERTY, gearColor ?? '');
          gearDigit.textContent = gearText;
        }
      });
    },
    [player, sessionStore, settings, showFill, showComb]
  );

  return (
    <div ref={rootRef} className={styles.root}>
      <div className={styles.clip}>
        <SteeringMarker />

        {showFill && (
          <svg
            className={styles.arc}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            aria-hidden="true"
          >
            <path className={styles.trackDim} />

            <path className={styles.trackShift} />

            <path className={styles.trackRedline} />

            <path className={styles.fillArc} />
          </svg>
        )}

        {showComb && <RpmComb />}

        <div className={styles.scrim} />

        {showGlow && <div className={styles.coreGlow} />}

        {showShiftFlash && <div className={styles.shiftFlash} />}

        <div className={styles.core}>
          <span className={styles.gear} />
        </div>
      </div>

      <div className={styles.sheen} />
    </div>
  );
});

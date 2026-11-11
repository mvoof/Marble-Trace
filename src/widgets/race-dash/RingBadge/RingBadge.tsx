import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';

import { ShiftDigit } from '@entities/player/readouts/ShiftDigit';
import { useLiveParts, type LiveParts } from '@shared/ui/live/live-parts';
import {
  computeShiftThresholds,
  rpmDigitColorsOf,
} from '@shared/lib/car-signals';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { useBlinkHandle, type BlinkCycle } from '@shared/hooks/useBlink';
import { computeRpmZoneState, rpmFillColor } from '../race-dash-utils';
import { usePlayerStore } from '@entities/player/player-context';
import { useSessionStore } from '@entities/session/session-context';
import { RpmComb } from '../RpmComb/RpmComb';
import { SteeringMarker } from '../SteeringMarker/SteeringMarker';
import { ARC_SWEEP_DEG, RING_SIZE, ringArcPath } from './ring-geometry';

import styles from './RingBadge.module.scss';
import type { RaceDashWidgetSettings } from '../settings-schema';

const MIN_VISIBLE_ARC_DEG = 0.5;
const SHIFT_FLASH_MS = 220;

/** The core glow strobes at the redline, faster than the digit: 250 ms a side. */
const CORE_GLOW_BLINK: BlinkCycle = { stepMs: 250, steps: 2 };

const GLOW_COLOR_PROPERTY = '--core-glow-color';
const GLOW_SCALE_PROPERTY = '--core-glow-scale';

type RingPart = 'dim' | 'shift' | 'redline' | 'fill' | 'glow';

const writeArc = (
  parts: LiveParts<RingPart>,
  name: RingPart,
  path: string,
  isVisible: boolean
) => {
  parts.attribute(name, 'd', isVisible ? path : '');
  parts.style(name, 'display', isVisible ? null : 'none');
};

/**
 * The rev ring and the gear inside it. Everything it draws follows the revs,
 * which change on every physics tick, so the arcs, the glow and the digit are
 * written straight to the DOM and React renders the badge once per setting
 * change. See `docs/rendering.md`.
 */
export const RingBadge = observer(() => {
  const player = usePlayerStore();
  const sessionStore = useSessionStore();

  const settings = useWidgetSettings<RaceDashWidgetSettings>('race-dash');
  const glowBlink = useBlinkHandle();
  const parts = useLiveParts<RingPart>();

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
    (_element, scheduleWrite) => {
      // oxlint-disable-next-line no-restricted-properties
      const currentGear = player.carDynamics?.gear ?? 0;
      // oxlint-disable-next-line no-restricted-properties
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
      const isAtBlink = zone === 'blink';

      const isBlink = settings.blinkAtShift && isAtBlink;

      // Grows from a small dot at the center out to the full circle by the time
      // rpm hits the shift point — same zone colors as the fill arc, just as a
      // filled disc instead of a ring.
      const coreGlowScale = isAtBlink
        ? 1
        : Math.min(Math.max(rpm / (shiftRpm || 1), 0), 1);

      scheduleWrite(() => {
        writeArc(
          parts,
          'dim',
          ringArcPath(0, shiftStartDeg),
          shiftStartDeg > MIN_VISIBLE_ARC_DEG
        );
        writeArc(
          parts,
          'shift',
          ringArcPath(shiftStartDeg, blinkStartDeg),
          blinkStartDeg - shiftStartDeg > MIN_VISIBLE_ARC_DEG
        );
        writeArc(
          parts,
          'redline',
          ringArcPath(blinkStartDeg, ARC_SWEEP_DEG),
          blinkStartDeg < ARC_SWEEP_DEG - MIN_VISIBLE_ARC_DEG
        );
        writeArc(
          parts,
          'fill',
          ringArcPath(0, fillDeg),
          fillDeg > MIN_VISIBLE_ARC_DEG
        );
        parts.style('fill', 'stroke', fillColor);

        parts.toggleClass('glow', styles.coreGlowBlink, isBlink);
        glowBlink.attach(parts.elementOf('glow'));
        glowBlink.run(isBlink ? CORE_GLOW_BLINK : null);
        parts.style('glow', GLOW_COLOR_PROPERTY, fillColor);
        parts.style('glow', GLOW_SCALE_PROPERTY, String(coreGlowScale));
      });
    },
    [player, sessionStore, settings, glowBlink, parts]
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
            <path ref={parts.ref('dim')} className={styles.trackDim} />

            <path ref={parts.ref('shift')} className={styles.trackShift} />

            <path ref={parts.ref('redline')} className={styles.trackRedline} />

            <path ref={parts.ref('fill')} className={styles.fillArc} />
          </svg>
        )}

        {showComb && <RpmComb />}

        <div className={styles.scrim} />

        {showGlow && (
          <div ref={parts.ref('glow')} className={styles.coreGlow} />
        )}

        {showShiftFlash && <div className={styles.shiftFlash} />}

        <div className={styles.core}>
          {/* With neither ring scale shown the digit stays white — the core
              glow already carries the zone color, so tinting the digit too
              would wash the two together. */}
          <ShiftDigit
            format="gear"
            zoneColors={
              (showFill || showComb) && settings.colorizeByRpmZone
                ? rpmDigitColorsOf(settings)
                : null
            }
            blink={settings.blinkAtShift}
            className={styles.gear}
          />
        </div>
      </div>

      <div className={styles.sheen} />
    </div>
  );
});

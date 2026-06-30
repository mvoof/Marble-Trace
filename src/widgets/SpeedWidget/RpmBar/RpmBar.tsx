import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

import type { SpeedWidgetSettings } from '@/types/widget-settings';
import { computeShiftThresholds } from '@utils/widget/shift-thresholds';
import { getShiftZoneColor } from '@utils/widget/speed-utils';
import { usePitState } from '../hooks/usePitState';
import type { PitState } from '../hooks/usePitState';

import styles from './RpmBar.module.scss';
import {
  usePlayerStore,
  useSessionStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const LED_COUNT = 22;

const PIT_YELLOW = '#d97706';
const PIT_BLUE = '#2563eb';
const PIT_WHITE = 'rgba(255,255,255,0.85)';
const PIT_RED = '#dc2626';
const PIT_RED_DIM = 'rgba(220,38,38,0.12)';
const LED_OFF = 'rgba(255,255,255,0.06)';

const PIT_TICK_INTERVAL: Record<PitState, number> = {
  normal: 0,
  'pit-lane': 500,
  'limiter-active': 500,
  'over-limit': 500,
};

// Left indicators: LED[0], LED[1]. Right indicators: LED[20], LED[21].
// Main body: LED[2..19] (18 LEDs).
// Indicator animation: sequential inward — tick%2===0: outermost (0,21) lit; tick%2===1: next inward (1,20) lit.
const isIndicator = (i: number): boolean => i <= 1 || i >= LED_COUNT - 2;

const getIndicatorColor = (
  i: number,
  pitState: PitState,
  tick: number
): string => {
  const isOutermost = i === 0 || i === LED_COUNT - 1;
  const lit = tick % 2 === 0 ? isOutermost : !isOutermost;

  if (!lit) return LED_OFF;

  if (pitState === 'pit-lane') return PIT_RED;
  if (pitState === 'limiter-active') return PIT_YELLOW;

  return LED_OFF;
};

export interface RpmColors {
  low: string;
  mid: string;
  high: string;
  shift: string;
  limit: string;
}

const getPitLedColor = (
  i: number,
  pitState: PitState,
  tick: number
): string => {
  // Over-limit overrides everything: all LEDs alternate red/dim every other.
  if (pitState === 'over-limit') {
    return i % 2 === tick % 2 ? PIT_RED : PIT_RED_DIM;
  }

  if (isIndicator(i)) return getIndicatorColor(i, pitState, tick);

  // Main body (LED 2..19).
  if (pitState === 'pit-lane') {
    return (i + tick * 2) % 4 < 2 ? PIT_YELLOW : LED_OFF;
  }

  if (pitState === 'limiter-active') {
    return (i + tick) % 2 === 0 ? PIT_BLUE : PIT_WHITE;
  }

  return LED_OFF;
};

export const RpmBar = observer(() => {
  const { carDynamics, carStatus } = usePlayerStore();
  const { sessionInfo } = useSessionStore();
  const widgetSettings = useWidgetSettingsStore();
  const { pitState, showPitAssist } = usePitState();

  const effectivePitState: PitState = showPitAssist ? pitState : 'normal';

  const {
    rpmColorLow,
    rpmColorMid,
    rpmColorHigh,
    rpmColorShift,
    rpmColorLimit,
    ledShape,
    showRpmBar,
  } = widgetSettings.getSettings<SpeedWidgetSettings>('speed');

  const isPitMode = effectivePitState !== 'normal';

  const [tick, setTick] = useState(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (!isPitMode) {
      setTick(0);
      return;
    }

    const interval = PIT_TICK_INTERVAL[effectivePitState];

    if (interval === 0) {
      return;
    }

    const loop = (now: number) => {
      if (now - lastTimeRef.current >= interval) {
        setTick((prev) => prev + 1);
        lastTimeRef.current = now;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [isPitMode, effectivePitState]);

  if (!showRpmBar && !isPitMode) {
    return null;
  }

  const isCircle = ledShape === 'circle';
  const isParallelogram = ledShape === 'parallelogram';
  const borderRadius = isCircle ? '50%' : isParallelogram ? '0' : '15%';
  const clipPathLeft = isParallelogram
    ? 'polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)'
    : undefined;

  if (isPitMode) {
    return (
      <div className={styles.rpmBar}>
        {Array.from({ length: LED_COUNT }, (_, index) => {
          const color = getPitLedColor(index, effectivePitState, tick);
          const isDim =
            color === PIT_RED_DIM ||
            color === LED_OFF ||
            color === 'transparent';
          const clipPath = clipPathLeft;

          return (
            <div
              key={`led-${index}`}
              className={`${styles.rpmSeg} ${!isDim ? styles.rpmSegLit : ''}`}
              style={
                {
                  '--rpm-seg-color': color,
                  borderRadius,
                  clipPath,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>
    );
  }

  const colors: RpmColors = {
    low: rpmColorLow,
    mid: rpmColorMid,
    high: rpmColorHigh,
    shift: rpmColorShift,
    limit: rpmColorLimit,
  };

  const rpm = carDynamics?.rpm ?? 0;
  const { shiftRpm, blinkRpm } = computeShiftThresholds(sessionInfo, carStatus);

  const isShift = rpm >= shiftRpm;
  const isBlink = rpm >= blinkRpm;

  const displayPct = Math.min(Math.max(rpm / (blinkRpm || 1), 0), 1);
  const litCount = Math.floor(displayPct * LED_COUNT);

  return (
    <div className={`${styles.rpmBar} ${isBlink ? styles.rpmBarBlink : ''}`}>
      {Array.from({ length: LED_COUNT }, (_, index) => {
        const isLit = index < litCount;

        const clipPath = clipPathLeft;

        if (!isLit) {
          return (
            <div
              key={`led-${index}`}
              className={styles.rpmSeg}
              style={{ borderRadius, clipPath }}
            />
          );
        }

        const color = isBlink
          ? colors.limit
          : isShift
            ? colors.shift
            : getShiftZoneColor((index + 1) / LED_COUNT, colors);

        return (
          <div
            key={`led-${index}`}
            className={`${styles.rpmSeg} ${styles.rpmSegLit}`}
            style={
              {
                '--rpm-seg-color': color,
                borderRadius,
                clipPath: clipPathLeft,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
});

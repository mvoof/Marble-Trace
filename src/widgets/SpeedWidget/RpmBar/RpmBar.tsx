import React, { useLayoutEffect, useRef, useState } from 'react';
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

const PIT_YELLOW = '#eab308';
const PIT_GREEN = '#16a34a';
const PIT_BLUE = '#2563eb';
const PIT_WHITE = 'rgba(255,255,255,0.85)';
const PIT_RED = '#dc2626';
const PIT_RED_DIM = 'rgba(220,38,38,0.12)';
const LED_OFF = 'rgba(255,255,255,0.06)';

const PIT_TICK_INTERVAL: Record<PitState, number> = {
  normal: 0,
  'pit-lane': 100,
  'limiter-active': 600,
  'limiter-near-exit': 600,
  'limiter-exit': 420,
  'over-limit': 80,
};

// Left indicators: LED[0], LED[1]. Right indicators: LED[20], LED[21].
// Main body: LED[2..19] (18 LEDs).
// Indicator animation: sequential inward — tick%2===0: outermost (0,21) lit; tick%2===1: next inward (1,20) lit.
const isIndicator = (i: number): boolean => i <= 1 || i >= LED_COUNT - 2;

const getIndicatorColor = (
  i: number,
  pitState: PitState,
  indicatorTick: number
): string => {
  const isOutermost = i === 0 || i === LED_COUNT - 1;
  const lit = indicatorTick % 2 === 0 ? isOutermost : !isOutermost;

  if (!lit) return LED_OFF;

  if (pitState === 'pit-lane') return PIT_RED;
  if (pitState === 'over-limit') return PIT_RED;
  if (pitState === 'limiter-active') return PIT_YELLOW;
  if (pitState === 'limiter-near-exit') return PIT_GREEN;
  if (pitState === 'limiter-exit') return PIT_GREEN;

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
  tick: number,
  indicatorTick: number
): string => {
  if (isIndicator(i)) return getIndicatorColor(i, pitState, indicatorTick);

  if (i === 2 || i === LED_COUNT - 3) return LED_OFF;

  // Over-limit: double pulse — flash, flash, long pause.
  if (pitState === 'over-limit') {
    const phase = tick % 16;
    const isOn = phase === 0 || phase === 2;

    return isOn ? PIT_RED : LED_OFF;
  }

  // Main body (LED 3..18) — wave expands from center outward, fading toward edges, then all off.
  if (pitState === 'pit-lane') {
    const RADIUS = 8;
    const CYCLE = RADIUS + 4;
    const phase = tick % CYCLE;
    const isExpanding = phase < RADIUS;

    if (!isExpanding) return LED_OFF;

    const bodyIndex = i - 3;
    const distFromCenter = Math.abs(bodyIndex - 7.5);

    if (distFromCenter > phase) return LED_OFF;

    const opacity = Math.max(0.05, 1 - distFromCenter * 0.12);

    return `rgba(234,179,8,${opacity.toFixed(2)})`;
  }

  if (pitState === 'limiter-active' || pitState === 'limiter-near-exit') {
    const bodyIndex = i - 3;
    const offset = tick % 2;
    const slot = (bodyIndex + offset) % 5;

    if (slot === 0 || slot === 1) return PIT_BLUE;
    if (slot === 3) return PIT_WHITE;

    return LED_OFF;
  }

  if (pitState === 'limiter-exit') {
    return LED_OFF;
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
  const [indicatorTick, setIndicatorTick] = useState(0);
  const rafRef = useRef<number>(0);
  const lastBodyRef = useRef(0);
  const lastIndicatorRef = useRef(0);

  useLayoutEffect(() => {
    if (!isPitMode) {
      setTick(0);
      setIndicatorTick(0);
      return;
    }

    const bodyInterval = PIT_TICK_INTERVAL[effectivePitState];
    const indicatorInterval = 260;

    if (bodyInterval === 0) {
      return;
    }

    const loop = (now: number) => {
      if (now - lastBodyRef.current >= bodyInterval) {
        setTick((prev) => prev + 1);
        lastBodyRef.current = now;
      }

      if (now - lastIndicatorRef.current >= indicatorInterval) {
        setIndicatorTick((prev) => prev + 1);
        lastIndicatorRef.current = now;
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
          const color = getPitLedColor(
            index,
            effectivePitState,
            tick,
            indicatorTick
          );
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

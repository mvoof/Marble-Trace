import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';

import type { RpmLightsWidgetSettings } from '@/types/widget-settings';
import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { usePitState, type PitState } from '@ui/hooks/usePitState';

import {
  LED_COLOR_PROPERTY,
  LED_COUNT,
  LED_OFF,
  ledShapeStyle,
} from '../led-shape';
import styles from '../RpmLightsWidget.module.scss';

const PIT_YELLOW = '#eab308';
const PIT_GREEN = '#16a34a';
const PIT_BLUE = '#2563eb';
const PIT_WHITE = 'rgba(255,255,255,0.85)';
const PIT_RED = '#dc2626';

const INDICATOR_INTERVAL_MS = 260;

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
const isIndicator = (index: number): boolean =>
  index <= 1 || index >= LED_COUNT - 2;

const getIndicatorColor = (
  index: number,
  pitState: PitState,
  indicatorTick: number
): string => {
  const isOutermost = index === 0 || index === LED_COUNT - 1;
  const lit = indicatorTick % 2 === 0 ? isOutermost : !isOutermost;

  if (!lit) return LED_OFF;

  if (pitState === 'pit-lane') return PIT_RED;
  if (pitState === 'over-limit') return PIT_RED;
  if (pitState === 'limiter-active') return PIT_YELLOW;
  if (pitState === 'limiter-near-exit') return PIT_GREEN;
  if (pitState === 'limiter-exit') return PIT_GREEN;

  return LED_OFF;
};

const getPitLedColor = (
  index: number,
  pitState: PitState,
  tick: number,
  indicatorTick: number
): string => {
  if (isIndicator(index)) {
    return getIndicatorColor(index, pitState, indicatorTick);
  }

  if (index === 2 || index === LED_COUNT - 3) return LED_OFF;

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

    const bodyIndex = index - 3;
    const distFromCenter = Math.abs(bodyIndex - 7.5);

    if (distFromCenter > phase) return LED_OFF;

    const opacity = Math.max(0.05, 1 - distFromCenter * 0.12);

    return `rgba(234,179,8,${opacity.toFixed(2)})`;
  }

  if (pitState === 'limiter-active' || pitState === 'limiter-near-exit') {
    const bodyIndex = index - 3;
    const offset = tick % 2;
    const slot = (bodyIndex + offset) % 5;

    if (slot === 0 || slot === 1) return PIT_BLUE;
    if (slot === 3) return PIT_WHITE;

    return LED_OFF;
  }

  return LED_OFF;
};

/**
 * The pit animation, mounted only while the car is on pit road or the limiter is
 * on. Its LEDs follow a timer of its own rather than telemetry, so it is a
 * separate component: the racing bar beside it never pays for these intervals.
 */
export const PitBar = observer(() => {
  const { pitState } = usePitState();
  const { ledShape } = useWidgetSettings<RpmLightsWidgetSettings>('rpm-lights');

  const [tick, setTick] = useState(0);
  const [indicatorTick, setIndicatorTick] = useState(0);
  const rafRef = useRef<number>(0);
  const lastBodyRef = useRef(0);
  const lastIndicatorRef = useRef(0);

  const bodyInterval = PIT_TICK_INTERVAL[pitState];

  useEffect(() => {
    if (bodyInterval === 0) {
      return;
    }

    const loop = (now: number) => {
      if (now - lastBodyRef.current >= bodyInterval) {
        setTick((previous) => previous + 1);
        lastBodyRef.current = now;
      }

      if (now - lastIndicatorRef.current >= INDICATOR_INTERVAL_MS) {
        setIndicatorTick((previous) => previous + 1);
        lastIndicatorRef.current = now;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [bodyInterval]);

  const ledStyle = ledShapeStyle(ledShape);

  return (
    <WidgetPanel
      direction="row"
      style={{ gap: undefined }}
      className={styles.bar}
    >
      {Array.from({ length: LED_COUNT }, (_unused, index) => {
        const color = getPitLedColor(index, pitState, tick, indicatorTick);
        const isDim = color === LED_OFF;

        return (
          <div
            key={`led-${index}`}
            className={isDim ? styles.seg : `${styles.seg} ${styles.segLit}`}
            style={
              { ...ledStyle, [LED_COLOR_PROPERTY]: color } as CSSProperties
            }
          />
        );
      })}
    </WidgetPanel>
  );
});

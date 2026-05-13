import { useImperativeHandle, useRef } from 'react';
import type { Ref } from 'react';
import { getShiftZoneColor } from '../speed-utils';
import styles from './RpmBar.module.scss';

const LED_COUNT = 20;

interface RpmColors {
  low: string;
  mid: string;
  high: string;
  shift: string;
  limit: string;
}

interface RpmBarProps {
  shiftRpm: number;
  blinkRpm: number;
  colors: RpmColors;
  ref?: Ref<RpmBarHandle>;
}

export interface RpmBarHandle {
  update: (rpm: number) => void;
}

export const RpmBar = ({ shiftRpm, blinkRpm, colors, ref }: RpmBarProps) => {
  const barRef = useRef<HTMLDivElement>(null);

  const prevLitCountRef = useRef(-1);
  const prevPhaseRef = useRef<'normal' | 'shift' | 'blink' | null>(null);

  useImperativeHandle(ref, () => ({
    update: (rpm) => {
      if (!barRef.current) return;

      const isShift = rpm >= shiftRpm;
      const isBlink = rpm >= blinkRpm;
      const phase = isBlink ? 'blink' : isShift ? 'shift' : 'normal';

      const displayPct = Math.min(Math.max(rpm / (blinkRpm || 1), 0), 1);
      const litCount = Math.floor(displayPct * LED_COUNT);

      if (
        litCount === prevLitCountRef.current &&
        phase === prevPhaseRef.current
      ) {
        return;
      }

      barRef.current.classList.toggle(styles.rpmBarBlink, isBlink);

      const children = barRef.current.children;

      for (let i = 0; i < children.length; i++) {
        const el = children[i] as HTMLElement;

        if (i < litCount) {
          const color = isBlink
            ? colors.limit
            : isShift
              ? colors.shift
              : getShiftZoneColor((i + 1) / LED_COUNT, colors);

          el.style.setProperty('--rpm-seg-color', color);
          el.classList.add(styles.rpmSegLit);
        } else {
          el.classList.remove(styles.rpmSegLit);
        }
      }

      prevLitCountRef.current = litCount;
      prevPhaseRef.current = phase;
    },
  }));

  return (
    <div ref={barRef} className={styles.rpmBar}>
      {Array.from({ length: LED_COUNT }, (_, i) => (
        <div key={`led-${i}`} className={styles.rpmSeg} />
      ))}
    </div>
  );
};

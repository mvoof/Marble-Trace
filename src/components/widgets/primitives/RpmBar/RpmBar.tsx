import { useMemo } from 'react';

import type { RpmColorTheme } from '../../../../store/widget-settings.store';
import styles from './RpmBar.module.scss';

const SEGMENT_COUNT = 32;

interface RpmColors {
  low: string;
  mid: string;
  high: string;
  limit: string;
}

interface RpmBarProps {
  rpm: number;
  maxRpm?: number;
  shiftRpm?: number;
  shiftIndicatorPct?: number;
  colors: RpmColors;
  colorTheme?: RpmColorTheme;
}

function generateLabels(maxRpm: number) {
  const step = maxRpm <= 5000 ? 1000 : 2000;
  const labels = [];

  for (let v = 0; v <= maxRpm; v += step) {
    labels.push({
      value: v,
      label: v >= 1000 ? `${v / 1000}k` : String(v),
    });
  }

  return labels;
}

function getSegmentColor(
  index: number,
  total: number,
  colors: RpmColors,
  theme: RpmColorTheme,
  shiftPct: number
): string {
  const percent = (index / total) * 100;

  if (theme === 'gradient') {
    const ratio = index / total;
    const r = Math.floor(255 * ratio);
    const g = Math.floor(255 * (1 - ratio));
    return `rgb(${r}, ${g}, 50)`;
  }

  if (theme === 'classic') {
    return percent > shiftPct ? colors.limit : '#ffffff';
  }

  if (percent > shiftPct) return colors.limit;
  if (percent > shiftPct * 0.82) return colors.high;
  if (percent > shiftPct * 0.53) return colors.mid;
  return colors.low;
}

export const RpmBar = ({
  rpm,
  maxRpm = 10000,
  shiftRpm,
  shiftIndicatorPct,
  colors,
  colorTheme = 'custom',
}: RpmBarProps) => {
  const scaleMax = shiftRpm ?? maxRpm;
  const fillPct = Math.min(rpm / scaleMax, 1);
  const activeLimit = Math.floor(fillPct * SEGMENT_COUNT);
  const shiftPct = 85;
  const isRedline =
    shiftIndicatorPct != null ? shiftIndicatorPct >= 0.97 : fillPct >= 0.97;

  const labels = useMemo(() => generateLabels(scaleMax), [scaleMax]);

  const segments = useMemo(() => {
    return Array.from({ length: SEGMENT_COUNT }, (_, i) => {
      const color = getSegmentColor(
        i,
        SEGMENT_COUNT,
        colors,
        colorTheme,
        shiftPct
      );
      const isLimit = (i / SEGMENT_COUNT) * 100 > shiftPct;
      return { color, isLimit };
    });
  }, [colors, colorTheme, shiftPct]);

  const labelStyles = useMemo(() => {
    return labels.map(({ value }) => {
      const diff = Math.abs(rpm - value);
      const isNearMax = Math.abs(scaleMax - value) < 500;
      const isCurrentRange = diff < 1500;

      // Only show numbers near current RPM or at the very end of the scale
      if (!isNearMax && !isCurrentRange) {
        return { opacity: 0, transform: 'scale(0.5)' };
      }

      const proximity = Math.max(0, 1 - diff / 1500);
      const baseOp = rpm > value ? 0.05 : 0.2;

      return {
        color: `rgba(255, 255, 255, ${baseOp + proximity * 0.8})`,
        transform: `scale(${1 + proximity * 0.2})`,
        opacity: 1,
      };
    });
  }, [rpm, labels, scaleMax]);

  return (
    <span className={styles.wrapper}>
      <span className={styles.labels}>
        {labels.map((item, i) => (
          <span
            key={item.value}
            className={styles.label}
            style={labelStyles[i]}
          >
            {item.label}
          </span>
        ))}
      </span>

      <span className={styles.bar}>
        {segments.map((seg, i) => {
          const isActive = i < activeLimit;
          const dist = isActive ? activeLimit - 1 - i : 0;
          const isLeading = isActive && dist === 0;

          // Tail opacity: more aggressive falloff (shorter tail)
          // Also apply a general gradient based on position to make the start more transparent
          const posRatio = i / SEGMENT_COUNT;
          const posFade = 0.2 + posRatio * 0.8; // Start at 20% opacity, end at 100%
          const tailFade = Math.pow(0.85, dist); // Exponential falloff for the tail

          return (
            <span
              key={i}
              className={`${styles.segment} ${isActive ? styles.active : ''} ${isRedline && isActive && seg.isLimit ? styles.redline : ''}`}
              style={
                isActive
                  ? {
                      backgroundColor: seg.color,
                      opacity: isLeading
                        ? 1
                        : Math.max(0.02, tailFade * posFade),
                      boxShadow: isLeading ? `0 0 12px ${seg.color}` : 'none',
                    }
                  : {
                      opacity: 0.05 * posFade,
                    }
              }
            />
          );
        })}
      </span>
    </span>
  );
};

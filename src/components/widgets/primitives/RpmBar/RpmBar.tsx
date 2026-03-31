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
  colors,
  colorTheme = 'custom',
}: RpmBarProps) => {
  const activeLimit = Math.floor((rpm / maxRpm) * SEGMENT_COUNT);
  const shiftPct = shiftRpm ? (shiftRpm / maxRpm) * 100 : 85;
  const isRedline = shiftRpm ? rpm >= shiftRpm * 0.97 : rpm >= maxRpm * 0.94;

  const labels = useMemo(() => generateLabels(maxRpm), [maxRpm]);

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
      if (value < rpm - 350) {
        return {
          color: 'rgba(255, 255, 255, 0.02)',
          transform: 'scale(0.85)',
        };
      }

      const diff = Math.abs(rpm - value);
      const proximity = Math.max(0, 1 - diff / 1500);
      const baseOp = rpm > value ? 0.02 : 0.15;

      return {
        color: `rgba(255, 255, 255, ${baseOp + proximity * 0.85})`,
        transform: `scale(${1 + proximity * 0.15})`,
      };
    });
  }, [rpm, labels]);

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
          const segmentRatio = i / SEGMENT_COUNT;
          const tailOpacity = Math.pow(segmentRatio, 2);

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
                        : Math.max(0.05, (1 - dist * 0.15) * tailOpacity),
                      boxShadow: isLeading ? `0 0 10px ${seg.color}` : 'none',
                    }
                  : undefined
              }
            />
          );
        })}
      </span>
    </span>
  );
};

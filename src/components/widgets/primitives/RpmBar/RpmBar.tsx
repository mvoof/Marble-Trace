import { useMemo } from 'react';

import type { RpmColorTheme } from '../../../../store/widget-settings.store';
import styles from './RpmBar.module.scss';

const SEGMENT_COUNT = 32;
const RPM_LABELS = [
  { value: 0, label: '0' },
  { value: 2000, label: '2k' },
  { value: 4000, label: '4k' },
  { value: 6000, label: '6k' },
  { value: 8000, label: '8k' },
  { value: 10000, label: '10k' },
];

interface RpmColors {
  low: string;
  mid: string;
  high: string;
  limit: string;
}

interface RpmBarProps {
  rpm: number;
  maxRpm?: number;
  colors: RpmColors;
  colorTheme?: RpmColorTheme;
}

function getSegmentColor(
  index: number,
  total: number,
  colors: RpmColors,
  theme: RpmColorTheme
): string {
  const percent = (index / total) * 100;

  if (theme === 'gradient') {
    const ratio = index / total;
    const r = Math.floor(255 * ratio);
    const g = Math.floor(255 * (1 - ratio));
    return `rgb(${r}, ${g}, 50)`;
  }

  if (theme === 'classic') {
    return percent > 85 ? colors.limit : '#ffffff';
  }

  if (percent > 85) return colors.limit;
  if (percent > 70) return colors.high;
  if (percent > 45) return colors.mid;
  return colors.low;
}

export const RpmBar = ({
  rpm,
  maxRpm = 10000,
  colors,
  colorTheme = 'custom',
}: RpmBarProps) => {
  const activeLimit = Math.floor((rpm / maxRpm) * SEGMENT_COUNT);
  const isRedline = rpm >= maxRpm * 0.94;

  const segments = useMemo(() => {
    return Array.from({ length: SEGMENT_COUNT }, (_, i) => {
      const color = getSegmentColor(i, SEGMENT_COUNT, colors, colorTheme);
      const percent = (i / SEGMENT_COUNT) * 100;
      const isLimit = percent > 85;
      return { color, isLimit };
    });
  }, [colors, colorTheme]);

  const labelStyles = useMemo(() => {
    return RPM_LABELS.map(({ value }) => {
      const diff = Math.abs(rpm - value);

      if (rpm > value + 350) {
        return { color: 'rgba(255, 255, 255, 0.04)', transform: 'scale(0.85)' };
      }

      const proximity = Math.max(0, 1 - diff / 1500);
      const baseOp = rpm > value ? 0.04 : 0.12;
      return {
        color: `rgba(255, 255, 255, ${baseOp + proximity * 0.85})`,
        transform: `scale(${1 + proximity * 0.15})`,
      };
    });
  }, [rpm]);

  return (
    <span className={styles.wrapper}>
      <span className={styles.labels}>
        {RPM_LABELS.map((item, i) => (
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

          return (
            <span
              key={i}
              className={`${styles.segment} ${isActive ? styles.active : ''} ${isRedline && isActive && seg.isLimit ? styles.redline : ''}`}
              style={
                isActive
                  ? {
                      backgroundColor: seg.color,
                      opacity: isLeading ? 1 : Math.max(0.15, 1 - dist * 0.15),
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

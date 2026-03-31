import styles from './ProgressBar.module.scss';

type BarHeight = 'sm' | 'md' | 'lg';

interface ProgressBarProps {
  value: number;
  color?: string;
  backgroundColor?: string;
  height?: BarHeight;
  label?: string;
  showValue?: boolean;
  gradient?: boolean;
  transition?: boolean;
  vertical?: boolean;
}

function gradientColor(value: number): string {
  if (value < 0.5) return '#00ff00';
  if (value < 0.75) return '#ffcc00';
  return '#ff3333';
}

export const ProgressBar = ({
  value,
  color,
  backgroundColor,
  height = 'md',
  label,
  showValue = false,
  gradient = false,
  transition = true,
  vertical = false,
}: ProgressBarProps) => {
  const clamped = Math.max(0, Math.min(1, value));
  const fillColor = gradient ? gradientColor(clamped) : color;

  if (vertical) {
    return (
      <span className={styles.verticalContainer}>
        <span
          className={`${styles.verticalTrack} ${styles[`width-${height}`]}`}
          style={backgroundColor ? { background: backgroundColor } : undefined}
        >
          <span
            className={`${styles.verticalFill} ${transition ? styles.verticalAnimated : ''}`}
            style={{
              height: `${clamped * 100}%`,
              ...(fillColor ? { background: fillColor } : {}),
            }}
          />
        </span>

        {label && <span className={styles.verticalLabel}>{label}</span>}
      </span>
    );
  }

  return (
    <span className={styles.container}>
      {(label || showValue) && (
        <span className={styles.labelRow}>
          {label && <span className={styles.label}>{label}</span>}

          {showValue && (
            <span className={styles.valueText}>
              {Math.round(clamped * 100)}%
            </span>
          )}
        </span>
      )}

      <span
        className={`${styles.track} ${styles[`height-${height}`]}`}
        style={backgroundColor ? { background: backgroundColor } : undefined}
      >
        <span
          className={`${styles.fill} ${transition ? styles.animated : ''}`}
          style={{
            width: `${clamped * 100}%`,
            ...(fillColor ? { background: fillColor } : {}),
          }}
        />
      </span>
    </span>
  );
};

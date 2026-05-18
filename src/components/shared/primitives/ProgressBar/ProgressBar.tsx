import { useImperativeHandle, useRef } from 'react';
import type { Ref } from 'react';
import styles from './ProgressBar.module.scss';

type BarHeight = 'sm' | 'md' | 'lg';

export interface ProgressBarHandle {
  update: (value: number) => void;
}

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
  rounded?: boolean;
  ref?: Ref<ProgressBarHandle>;
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
  rounded = true,
  ref,
}: ProgressBarProps) => {
  const fillRef = useRef<HTMLDivElement>(null);
  const valueTextRef = useRef<HTMLSpanElement>(null);

  const getFillColor = (v: number) => (gradient ? gradientColor(v) : color);

  useImperativeHandle(ref, () => ({
    update: (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      if (fillRef.current) {
        if (vertical) {
          fillRef.current.style.height = `${clamped * 100}%`;
        } else {
          fillRef.current.style.width = `${clamped * 100}%`;
        }

        const fillColor = getFillColor(clamped);
        if (fillColor) {
          fillRef.current.style.background = fillColor;
        }
      }
      if (valueTextRef.current) {
        valueTextRef.current.textContent = `${Math.round(clamped * 100)}%`;
      }
    },
  }));

  const clamped = Math.max(0, Math.min(1, value));
  const initialFillColor = getFillColor(clamped);

  if (vertical) {
    return (
      <div className={styles.verticalContainer}>
        <div
          className={`${styles.verticalTrack} ${styles[`width-${height}`]}${
            !rounded ? ` ${styles.noRadius}` : ''
          }`}
          style={backgroundColor ? { background: backgroundColor } : undefined}
        >
          <div
            ref={fillRef}
            className={`${styles.verticalFill} ${
              transition ? styles.verticalAnimated : ''
            }${!rounded ? ` ${styles.noRadius}` : ''}`}
            style={{
              height: `${clamped * 100}%`,
              ...(initialFillColor ? { background: initialFillColor } : {}),
            }}
          />
        </div>

        {label && <span className={styles.verticalLabel}>{label}</span>}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {(label || showValue) && (
        <div className={styles.labelRow}>
          {label && <span className={styles.label}>{label}</span>}

          {showValue && (
            <span ref={valueTextRef} className={styles.valueText}>
              {Math.round(clamped * 100)}%
            </span>
          )}
        </div>
      )}

      <div
        className={`${styles.track} ${styles[`height-${height}`]}${
          !rounded ? ` ${styles.noRadius}` : ''
        }`}
        style={backgroundColor ? { background: backgroundColor } : undefined}
      >
        <div
          ref={fillRef}
          className={`${styles.fill} ${
            transition ? styles.animated : ''
          }${!rounded ? ` ${styles.noRadius}` : ''}`}
          style={{
            width: `${clamped * 100}%`,
            ...(initialFillColor ? { background: initialFillColor } : {}),
          }}
        />
      </div>
    </div>
  );
};

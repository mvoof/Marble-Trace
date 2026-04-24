import { useEffect, useRef, type ReactNode } from 'react';
import styles from './WidgetScaler.module.scss';

interface WidgetScalerProps {
  designWidth: number;
  designHeight: number;
  background?: string;
  children: ReactNode;
  scale?: boolean;
}

export const WidgetScaler = ({
  designWidth,
  designHeight,
  background,
  children,
  scale = false,
}: WidgetScalerProps) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scale) return;

    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const update = () => {
      const { width, height } = outer.getBoundingClientRect();
      const factor = Math.min(width / designWidth, height / designHeight);
      inner.style.transform = `translate(-50%, -50%) scale(${factor})`;
    };

    const ro = new ResizeObserver(update);
    ro.observe(outer);
    update();

    return () => ro.disconnect();
  }, [designWidth, designHeight, scale]);

  if (!scale) {
    return (
      <div ref={outerRef} className={styles.outer} style={{ background }}>
        <div className={styles.innerAdaptive}>{children}</div>
      </div>
    );
  }

  return (
    <div ref={outerRef} className={styles.outer} style={{ background }}>
      <div
        ref={innerRef}
        className={styles.inner}
        style={{ width: designWidth, height: designHeight }}
      >
        {children}
      </div>
    </div>
  );
};

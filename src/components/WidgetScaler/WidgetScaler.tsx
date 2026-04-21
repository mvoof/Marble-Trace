import { useEffect, useRef, type ReactNode } from 'react';
import styles from './WidgetScaler.module.scss';

interface WidgetScalerProps {
  designWidth: number;
  designHeight: number;
  background?: string;
  children: ReactNode;
  adaptive?: boolean;
}

export const WidgetScaler = ({
  designWidth,
  designHeight,
  background,
  children,
  adaptive = false,
}: WidgetScalerProps) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const update = () => {
      const { width, height } = outer.getBoundingClientRect();

      if (adaptive) {
        const scale = width / designWidth;
        inner.style.fontSize = `${scale * 16}px`;
      } else {
        const scale = Math.min(width / designWidth, height / designHeight);
        inner.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
    };

    const ro = new ResizeObserver(update);
    ro.observe(outer);
    update();

    return () => {
      ro.disconnect();
      if (adaptive) inner.style.fontSize = '';
    };
  }, [designWidth, designHeight, adaptive]);

  if (adaptive) {
    return (
      <div ref={outerRef} className={styles.outer} style={{ background }}>
        <div ref={innerRef} className={styles.innerAdaptive}>
          {children}
        </div>
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

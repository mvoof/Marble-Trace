import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './WidgetScaler.module.scss';

interface WidgetScalerProps {
  designWidth: number;
  designHeight: number;
  background?: string;
  children: ReactNode;
}

/**
 * Scales widget content to fill the available container while preserving
 * the design aspect ratio. Uses transform: scale() centered within the container.
 *
 * Used by WidgetContainer (overlay) and directly in Storybook stories.
 */
export const WidgetScaler = ({
  designWidth,
  designHeight,
  background,
  children,
}: WidgetScalerProps) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setScale(Math.min(width / designWidth, height / designHeight));
    };

    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();

    return () => ro.disconnect();
  }, [designWidth, designHeight]);

  return (
    <div ref={outerRef} className={styles.outer} style={{ background }}>
      <div
        className={styles.inner}
        style={{
          width: designWidth,
          height: designHeight,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

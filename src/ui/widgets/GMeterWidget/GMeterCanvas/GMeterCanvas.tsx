import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { GMeterRings } from './GMeterRings/GMeterRings';
import { GMeterTrace } from './GMeterTrace/GMeterTrace';

import styles from './GMeterCanvas.module.scss';

export const GMeterCanvas = observer(() => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const wrap = wrapRef.current;

    if (!wrap) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });

    resizeObserver.observe(wrap);

    const rect = wrap.getBoundingClientRect();
    setDimensions({ width: rect.width, height: rect.height });

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className={styles.canvasWrap}>
      <GMeterRings width={dimensions.width} height={dimensions.height} />

      <GMeterTrace width={dimensions.width} height={dimensions.height} />
    </div>
  );
});

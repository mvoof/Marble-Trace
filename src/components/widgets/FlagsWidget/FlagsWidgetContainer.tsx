import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { parseSessionFlags } from './flags-utils';
import { BLOCK_PX } from './LedMatrix/LedMatrix';
import { FlagsWidget } from './FlagsWidget';

import styles from './FlagsWidgetContainer.module.scss';

export const FlagsWidgetContainer = observer(() => {
  const settings = widgetSettingsStore.getFlagsSettings();
  const sessionFlags = telemetryStore.session?.session_flags ?? null;
  const flag = parseSessionFlags(sessionFlags);

  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setBlinkOn((v) => !v), 400);
    return () => clearInterval(id);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState({ blocksX: 10, blocksY: 3 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBlocks({
        blocksX: Math.max(1, Math.floor(width / BLOCK_PX)),
        blocksY: Math.max(1, Math.floor(height / BLOCK_PX)),
      });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={styles.container}>
      <FlagsWidget
        flag={flag}
        settings={settings}
        blinkOn={blinkOn}
        blocksX={blocks.blocksX}
        blocksY={blocks.blocksY}
      />
    </div>
  );
});

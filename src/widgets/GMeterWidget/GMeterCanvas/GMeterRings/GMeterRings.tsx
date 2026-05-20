import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import { RADIUS_RATIO } from '../../../../utils/widget/g-meter-utils';

import styles from './GMeterRings.module.scss';

interface GMeterRingsProps {
  width: number;
  height: number;
}

export const GMeterRings = observer(({ width, height }: GMeterRingsProps) => {
  const { scale } = widgetSettingsStore.getGMeterSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || width === 0 || height === 0) {
      return;
    }

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.scale(dpr, dpr);

    const cx = width / 2;
    const cy = height / 2;

    const radius = Math.min(width, height) * RADIUS_RATIO * 0.5;

    const pxPerG = radius / scale;

    ctx.clearRect(0, 0, width, height);

    ctx.lineWidth = 1;

    for (let gValue = 1; gValue <= scale; gValue++) {
      ctx.beginPath();

      ctx.arc(cx, cy, gValue * pxPerG, 0, Math.PI * 2);

      ctx.strokeStyle =
        gValue === scale ? 'rgba(58,59,64,1)' : 'rgba(42,43,48,0.8)';

      ctx.stroke();
    }

    const labelSize = Math.round(14 * (width / 240));

    ctx.font = `600 ${labelSize}px 'Rajdhani', sans-serif`;
    ctx.fillStyle = 'rgba(120,120,130,0.7)';

    const pad = 3;

    for (let gValue = 1; gValue <= scale; gValue++) {
      const ringRadius = gValue * pxPerG;

      const label = String(gValue);

      const textWidth = ctx.measureText(label).width;

      ctx.textBaseline = 'bottom';
      ctx.fillText(label, cx - textWidth / 2, cy - ringRadius - pad);

      ctx.textBaseline = 'top';
      ctx.fillText(label, cx - textWidth / 2, cy + ringRadius + pad);

      ctx.textBaseline = 'middle';

      ctx.fillText(label, cx - ringRadius - textWidth - pad, cy);
      ctx.fillText(label, cx + ringRadius + pad, cy);
    }

    ctx.beginPath();

    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);

    ctx.strokeStyle = 'rgba(58,59,64,0.8)';
    ctx.lineWidth = 1;

    ctx.stroke();
  }, [width, height, scale]);

  return <canvas ref={canvasRef} className={styles.canvas} />;
});

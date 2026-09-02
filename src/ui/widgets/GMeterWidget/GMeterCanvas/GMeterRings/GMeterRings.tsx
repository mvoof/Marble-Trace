import { useContext, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import {
  AXIS_OVERHANG,
  RADIUS_RATIO,
  RING_LABEL_ANGLE,
  RING_LABEL_GAP_PX,
} from '@ui/widgets/GMeterWidget/g-meter-utils';
import { resizeCanvasToDpr } from '@utils/canvas';

import type { GMeterWidgetSettings } from '@/types/widget-settings';
import styles from './GMeterRings.module.scss';
import { useWidgetSettingsStore } from '@store/root-store-context';
import { WidgetIdContext } from '@ui/app/overlay/components/WidgetContainer/WidgetIdContext';

const RING_COLOR = 'rgba(42,43,48,0.8)';
const OUTER_RING_COLOR = 'rgba(72,74,82,1)';
const AXIS_COLOR = 'rgba(64,66,74,0.85)';
const RING_LABEL_COLOR = 'rgba(120,120,130,0.7)';
const LABEL_BASE_WIDTH_PX = 240;
const LABEL_BASE_SIZE_PX = 13;

interface GMeterRingsProps {
  width: number;
  height: number;
}

export const GMeterRings = observer(({ width, height }: GMeterRingsProps) => {
  const widgetId = useContext(WidgetIdContext);
  const widgetSettings = useWidgetSettingsStore();

  const { scale } = widgetSettings.getSettings<GMeterWidgetSettings>('g-meter');
  const fontScale =
    widgetSettings.getWidget(widgetId)?.userSettings.fontScale ?? 1;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || width === 0 || height === 0) {
      return;
    }

    const ctx = resizeCanvasToDpr(canvas, width, height);

    if (!ctx) {
      return;
    }

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * RADIUS_RATIO * 0.5;
    const pxPerG = radius / scale;

    ctx.clearRect(0, 0, width, height);

    const labelSize = Math.round(
      LABEL_BASE_SIZE_PX * (width / LABEL_BASE_WIDTH_PX) * fontScale
    );

    ctx.font = `600 ${labelSize}px 'Rajdhani', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;

    for (let gValue = 1; gValue <= scale; gValue++) {
      const ringRadius = gValue * pxPerG;
      const label = String(gValue);
      const labelWidth = ctx.measureText(label).width;
      // The number stands in the ring rather than beside it, so the ring is cut
      // where the glyphs sit instead of being drawn through them.
      const halfGap = Math.min(
        Math.PI / 3,
        (labelWidth / 2 + RING_LABEL_GAP_PX) / ringRadius
      );

      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        ringRadius,
        RING_LABEL_ANGLE + halfGap,
        RING_LABEL_ANGLE - halfGap + Math.PI * 2
      );
      ctx.strokeStyle = gValue === scale ? OUTER_RING_COLOR : RING_COLOR;
      ctx.stroke();

      ctx.fillStyle = RING_LABEL_COLOR;
      ctx.fillText(
        label,
        cx + Math.cos(RING_LABEL_ANGLE) * ringRadius,
        cy + Math.sin(RING_LABEL_ANGLE) * ringRadius
      );
    }

    const axisReach = radius * AXIS_OVERHANG;

    ctx.beginPath();
    ctx.moveTo(cx, cy - axisReach);
    ctx.lineTo(cx, cy + axisReach);
    ctx.moveTo(cx - axisReach, cy);
    ctx.lineTo(cx + axisReach, cy);
    ctx.strokeStyle = AXIS_COLOR;
    ctx.stroke();
  }, [width, height, scale, fontScale]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      aria-label="G-meter rings"
    />
  );
});

import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import {
  RADIUS_RATIO,
  RIM_RADIUS_RATIO,
  RING_LABEL_ANGLE,
  RING_LABEL_GAP_PX,
} from '@widgets/g-meter/g-meter-utils';
import { resizeCanvasToDpr } from '@shared/lib/canvas';

import styles from './GMeterRings.module.scss';
import { useLiveWidgetsStore } from '@entities/layout/live-widgets-context';
import { useWidgetInstanceId } from '@entities/layout/useWidgetSettings';
import type { GMeterWidgetSettings } from '../../settings-schema';

// The grid is a reference, not a reading: hairlines in the radar scope's ink,
// so the trace and the rim paint are what the eye lands on.
const RING_COLOR = 'rgba(250,250,250,0.08)';
const OUTER_RING_COLOR = 'rgba(250,250,250,0.16)';
const AXIS_COLOR = 'rgba(250,250,250,0.07)';
const RIM_TRACK_COLOR = 'rgba(250,250,250,0.06)';
const RING_LABEL_COLOR = 'rgba(250,250,250,0.4)';
const HAIRLINE_WIDTH_PX = 0.75;
const LABEL_BASE_WIDTH_PX = 240;
const LABEL_BASE_SIZE_PX = 14;

interface GMeterRingsProps {
  width: number;
  height: number;
}

export const GMeterRings = observer(({ width, height }: GMeterRingsProps) => {
  const widgetId = useWidgetInstanceId('g-meter');
  const liveWidgets = useLiveWidgetsStore();

  const { scale } = useWidgetSettings<GMeterWidgetSettings>('g-meter');
  const fontScale =
    liveWidgets.getWidget(widgetId)?.userSettings.fontScale ?? 1;
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
    ctx.lineWidth = HAIRLINE_WIDTH_PX;

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

    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.strokeStyle = AXIS_COLOR;
    ctx.stroke();

    // The track the axis readings are painted along.
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(width, height) * RIM_RADIUS_RATIO, 0, Math.PI * 2);
    ctx.strokeStyle = RIM_TRACK_COLOR;
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

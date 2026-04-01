import { useEffect, useRef, useCallback } from 'react';
import { reaction } from 'mobx';

import { telemetryStore } from '../../../../store/telemetry.store';
import styles from './CanvasTrace.module.scss';

export interface CanvasTraceChannel {
  value: number;
  color: string;
}

interface CanvasTraceProps {
  channels: CanvasTraceChannel[];
  bufferSize?: number;
  height?: number;
  lineWidth?: number;
  fillContainer?: boolean;
}

export const CanvasTrace = ({
  channels,
  bufferSize = 300,
  height = 80,
  lineWidth = 1.5,
  fillContainer = true,
}: CanvasTraceProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<number[][]>([]);
  const rafRef = useRef<number>(0);
  const channelsRef = useRef(channels);

  channelsRef.current = channels;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const { width } = canvas;
    const h = canvas.height;
    const buffer = bufferRef.current;
    const numChannels = channelsRef.current.length;

    ctx.clearRect(0, 0, width, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;

    for (let i = 1; i <= 3; i++) {
      const y = h * (i / 4);

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    for (let ch = 0; ch < numChannels; ch++) {
      const color = channelsRef.current[ch]?.color ?? '#ffffff';

      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      let started = false;

      for (let i = 0; i < buffer.length; i++) {
        const sample = buffer[i];

        if (!sample || sample[ch] === undefined) continue;

        const x = (i / (bufferSize - 1)) * width;
        const y = h - sample[ch] * h;

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }
  }, [bufferSize, lineWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry) {
        const { width, height: containerHeight } = entry.contentRect;
        const resolvedHeight = fillContainer ? containerHeight : height;

        if (width <= 0 || resolvedHeight <= 0) return;

        canvas.width = width * window.devicePixelRatio;
        canvas.height = resolvedHeight * window.devicePixelRatio;

        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }

        canvas.style.width = `${width}px`;
        canvas.style.height = `${resolvedHeight}px`;
      }
    });

    resizeObserver.observe(canvas.parentElement ?? canvas);

    const disposeReaction = reaction(
      () => telemetryStore.frame,
      () => {
        const currentChannels = channelsRef.current;
        const sample = currentChannels.map((ch) => ch.value);

        bufferRef.current.push(sample);

        if (bufferRef.current.length > bufferSize) {
          bufferRef.current.shift();
        }
      }
    );

    const animate = () => {
      draw();
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      disposeReaction();
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
    };
  }, [bufferSize, height, fillContainer, draw]);

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
};

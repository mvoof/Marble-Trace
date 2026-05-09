import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';

import styles from './CanvasTrace.module.scss';

export interface CanvasTraceChannel {
  value: number;
  color: string;
}

export interface CanvasTraceHandle {
  pushSample: (values: number[]) => void;
}

interface CanvasTraceProps {
  channels: CanvasTraceChannel[];
  bufferSize?: number;
  height?: number;
  lineWidth?: number;
  fillContainer?: boolean;
}

export const CanvasTrace = forwardRef<CanvasTraceHandle, CanvasTraceProps>(
  (
    {
      channels,
      bufferSize = 300,
      height = 80,
      lineWidth = 1.5,
      fillContainer = true,
    },
    ref
  ) => {
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

    const scheduleDraw = useCallback(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => draw());
    }, [draw]);

    useImperativeHandle(
      ref,
      () => ({
        pushSample: (values: number[]) => {
          bufferRef.current.push(values);
          if (bufferRef.current.length > bufferSize) {
            bufferRef.current.shift();
          }
          scheduleDraw();
        },
      }),
      [bufferSize, scheduleDraw]
    );

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

        scheduleDraw();
      });

      resizeObserver.observe(canvas.parentElement ?? canvas);

      return () => {
        cancelAnimationFrame(rafRef.current);
        resizeObserver.disconnect();
      };
    }, [height, fillContainer, scheduleDraw]);

    // Legacy prop-driven data push (for non-imperative consumers)
    useEffect(() => {
      if (channels.length === 0) return;

      const sample = channels.map((ch) => ch.value);

      bufferRef.current.push(sample);

      if (bufferRef.current.length > bufferSize) {
        bufferRef.current.shift();
      }

      scheduleDraw();
    }, [channels, bufferSize, scheduleDraw]);

    return (
      <div className={styles.container}>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
    );
  }
);

CanvasTrace.displayName = 'CanvasTrace';

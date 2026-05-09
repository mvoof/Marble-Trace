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
    const bufferRef = useRef<Float32Array | null>(null);
    const headRef = useRef(0); // Index for the next sample
    const countRef = useRef(0); // Current number of samples in buffer
    const rafRef = useRef<number>(0);
    const channelsRef = useRef(channels);

    channelsRef.current = channels;

    // Ensure buffer is correctly sized
    if (
      !bufferRef.current ||
      bufferRef.current.length !== bufferSize * channels.length
    ) {
      bufferRef.current = new Float32Array(bufferSize * channels.length);
      headRef.current = 0;
      countRef.current = 0;
    }

    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !bufferRef.current) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const logicalW = canvas.width / dpr;
      const logicalH = canvas.height / dpr;

      const buffer = bufferRef.current;
      const numChannels = channelsRef.current.length;
      const currentCount = countRef.current;

      ctx.clearRect(0, 0, logicalW, logicalH);

      // Draw grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const y = logicalH * (i / 4);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(logicalW, y);
        ctx.stroke();
      }

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      for (let ch = 0; ch < numChannels; ch++) {
        const color = channelsRef.current[ch]?.color ?? '#ffffff';
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();

        let started = false;

        for (let i = 0; i < currentCount; i++) {
          const sampleIdx =
            (headRef.current - currentCount + i + bufferSize) % bufferSize;
          const val = buffer[sampleIdx * numChannels + ch];

          const x = (i / (bufferSize - 1)) * logicalW;
          const y = logicalH - val * logicalH;

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
          if (!bufferRef.current) return;

          const numChannels = channelsRef.current.length;
          const offset = headRef.current * numChannels;

          // Copy values into circular buffer
          for (let i = 0; i < numChannels; i++) {
            bufferRef.current[offset + i] = values[i] ?? 0;
          }

          headRef.current = (headRef.current + 1) % bufferSize;
          if (countRef.current < bufferSize) {
            countRef.current++;
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

          const dpr = window.devicePixelRatio || 1;
          canvas.width = width * dpr;
          canvas.height = resolvedHeight * dpr;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Use setTransform to avoid cumulative scaling
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    return (
      <div className={styles.container}>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
    );
  }
);

CanvasTrace.displayName = 'CanvasTrace';

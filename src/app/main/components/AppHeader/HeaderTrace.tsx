import { useLayoutEffect, useRef } from 'react';
import styles from './HeaderTrace.module.scss';

// Ambient header backdrop: a pair of telemetry-style waveforms slowly drifting
// left with a soft glow — on-theme for a racing telemetry app and calm enough
// to sit behind the brand/nav without competing with it. Replaces the old
// random-square glitch field and lives only in the header.
const THROTTLE_COLOR = 'rgba(16, 185, 129, 0.7)';
const BRAKE_COLOR = 'rgba(68, 199, 239, 0.5)';
const CLUTCH_COLOR = 'rgba(239, 68, 68, 0.5)';

// How many seconds one full drift cycle takes — higher = slower, calmer motion.
// This is the single, human-readable speed knob for the whole animation.
const DRIFT_SECONDS_PER_CYCLE = 14;

interface WaveSpec {
  color: string;
  // Wave height as a fraction of the header height.
  amplitude: number;
  // Horizontal wavelength: higher = more, tighter peaks across the width.
  frequency: number;
  // Starting phase so the waves don't overlap identically.
  phaseOffset: number;
  // Drift multiplier relative to the base speed (sign = direction).
  speed: number;
  // Vertical center as a fraction of the header height (0 = top, 1 = bottom).
  yFactor: number;
}

const WAVES: WaveSpec[] = [
  {
    color: THROTTLE_COLOR,
    amplitude: 0.2,
    frequency: 0.01,
    phaseOffset: 0,
    speed: 1,
    yFactor: 0.5,
  },
  {
    color: BRAKE_COLOR,
    amplitude: 0.15,
    frequency: 0.015,
    phaseOffset: Math.PI,
    speed: -0.7,
    yFactor: 0.62,
  },
  {
    color: CLUTCH_COLOR,
    amplitude: 0.12,
    frequency: 0.02,
    phaseOffset: Math.PI / 2,
    speed: 0.5,
    yFactor: 0.34,
  },
];

export const HeaderTrace = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    let width = 0;
    let height = 0;
    let frameHandle = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawWave = (wave: WaveSpec, phase: number) => {
      const midY = height * wave.yFactor;
      const amplitudePx = height * wave.amplitude;

      context.beginPath();

      for (let x = 0; x <= width; x += 4) {
        const value =
          Math.sin(x * wave.frequency + phase * wave.speed + wave.phaseOffset) *
          0.6;
        const secondary =
          Math.sin(x * wave.frequency * 2.3 + phase * wave.speed * 1.7) * 0.4;
        const y = midY + (value + secondary) * amplitudePx;

        if (x === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }

      context.strokeStyle = wave.color;
      context.lineWidth = 2;
      context.shadowColor = wave.color;
      context.shadowBlur = 14;
      context.stroke();
      context.shadowBlur = 0;
    };

    const render = (timestamp: number) => {
      context.clearRect(0, 0, width, height);

      // Base phase advances 2π (one full cycle) every DRIFT_SECONDS_PER_CYCLE.
      const elapsedSeconds = timestamp / 1000;
      const phase = (elapsedSeconds / DRIFT_SECONDS_PER_CYCLE) * Math.PI * 2;

      for (const wave of WAVES) {
        drawWave(wave, phase);
      }

      frameHandle = requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    frameHandle = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameHandle);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
  );
};

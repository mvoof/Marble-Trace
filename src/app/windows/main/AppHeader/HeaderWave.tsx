import { useEffect, useLayoutEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useSimStore } from '@entities/sim/sim-context';
import {
  advanceWaveClock,
  INITIAL_WAVE_CLOCK,
  waveLines,
  type WaveLine,
} from './header-wave';
import styles from './HeaderWave.module.scss';

/** Backing-store resolution cap: the wave is too soft to need more. */
const MAX_PIXEL_RATIO = 2;
/** Height of the fill under the first line, from the header's bottom, in px. */
const FILL_HEIGHT = 16;
/** How far either side of its peak a line drops to its shoulder strength. */
const STROKE_FADE_SPAN = 0.35;
/** The line's strength at the shoulders, as a share of its peak. */
const SHOULDER_STRENGTH = 0.5;
/** Keeps the shoulder stops off the gradient's ends, where it is transparent. */
const FADE_STOP_MARGIN = 0.02;

const rgba = ([red, green, blue]: WaveLine['rgb'], alpha: number) =>
  `rgba(${red},${green},${blue},${alpha})`;

const drawLine = (
  context: CanvasRenderingContext2D,
  line: WaveLine,
  width: number,
  height: number
) => {
  if (line.fillAlpha > 0) {
    const fill = context.createLinearGradient(
      0,
      height - FILL_HEIGHT,
      0,
      height
    );

    fill.addColorStop(0, rgba(line.rgb, 0));
    fill.addColorStop(1, rgba(line.rgb, line.fillAlpha));

    context.beginPath();
    context.moveTo(0, height);

    for (const point of line.points) {
      context.lineTo(point.x, point.y);
    }

    context.lineTo(width, height);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
  }

  // Brightest over the main bump, fading out toward both ends.
  const peak = line.peakShare;
  const stroke = context.createLinearGradient(0, 0, width, 0);

  stroke.addColorStop(0, rgba(line.rgb, 0));
  stroke.addColorStop(
    Math.max(FADE_STOP_MARGIN, peak - STROKE_FADE_SPAN),
    rgba(line.rgb, line.alpha * SHOULDER_STRENGTH)
  );
  stroke.addColorStop(peak, rgba(line.rgb, line.alpha));
  stroke.addColorStop(
    Math.min(1 - FADE_STOP_MARGIN, peak + STROKE_FADE_SPAN),
    rgba(line.rgb, line.alpha * SHOULDER_STRENGTH)
  );
  stroke.addColorStop(1, rgba(line.rgb, 0));

  context.beginPath();
  line.points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.strokeStyle = stroke;
  context.lineWidth = line.lineWidth;
  context.stroke();
};

/** Someone can see the window: focused and not minimised. */
const isWatched = () =>
  document.visibilityState === 'visible' && document.hasFocus();

/**
 * The calm wave along the bottom of the header. It moves only while the
 * window is watched — WebView2 keeps firing frames in a minimised or
 * background window, and this one sits behind the game for a whole session —
 * and turns from grey to colour when the sim connects.
 */
export const HeaderWave = observer(() => {
  const sim = useSimStore();
  const isConnected = sim.status === 'connected';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isConnectedRef = useRef(isConnected);
  // Redraws a paused wave after the sim's state changes; set by the loop's effect.
  const redrawHeldFrameRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
      return;
    }

    let width = 0;
    let height = 0;
    let clock = INITIAL_WAVE_CLOCK;
    let frameHandle = 0;
    let lastTimestamp = 0;

    const draw = () => {
      context.clearRect(0, 0, width, height);

      const lines = waveLines({
        width,
        height,
        phase: clock.phase,
        liveness: clock.liveness,
      });

      for (const line of lines) {
        drawLine(context, line, width, height);
      }
    };

    const step = (elapsedSeconds: number) => {
      clock = advanceWaveClock(clock, elapsedSeconds, {
        isWatched: isWatched(),
        isConnected: isConnectedRef.current,
      });
      draw();
    };

    const render = (timestamp: number) => {
      step((timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;
      frameHandle = requestAnimationFrame(render);
    };

    const syncLoop = () => {
      const isRunning = frameHandle !== 0;

      if (isWatched() && !isRunning) {
        lastTimestamp = performance.now();
        frameHandle = requestAnimationFrame(render);
      } else if (!isWatched() && isRunning) {
        cancelAnimationFrame(frameHandle);
        frameHandle = 0;
        // The held frame shows the sim's state as it is.
        step(0);
      }
    };

    const resize = () => {
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        MAX_PIXEL_RATIO
      );
      const box = canvas.getBoundingClientRect();

      width = box.width;
      height = box.height;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      // Resizing the backing store clears it; a held frame would go blank.
      if (frameHandle === 0) {
        step(0);
      }
    };

    redrawHeldFrameRef.current = () => {
      if (frameHandle === 0) {
        step(0);
      }
    };

    const resizeObserver = new ResizeObserver(resize);

    resizeObserver.observe(canvas);
    resize();
    syncLoop();
    window.addEventListener('focus', syncLoop);
    window.addEventListener('blur', syncLoop);
    document.addEventListener('visibilitychange', syncLoop);

    return () => {
      cancelAnimationFrame(frameHandle);
      resizeObserver.disconnect();
      redrawHeldFrameRef.current = () => {};
      window.removeEventListener('focus', syncLoop);
      window.removeEventListener('blur', syncLoop);
      document.removeEventListener('visibilitychange', syncLoop);
    };
  }, []);

  useEffect(() => {
    isConnectedRef.current = isConnected;
    redrawHeldFrameRef.current();
  }, [isConnected]);

  return <canvas ref={canvasRef} className={styles.wave} aria-hidden="true" />;
});

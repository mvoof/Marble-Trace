import React, { useEffect, useRef } from 'react';
import styles from './RandomGlitchCanvas.module.scss';

const CELL_SIZE = 14;
const GAP = 3;
const STEP = CELL_SIZE + GAP;

export const RandomGlitchCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    let rafId: number;
    let tickTimeout: ReturnType<typeof setTimeout>;

    let cols = 0;
    let rows = 0;

    let grid: number[][] = [];
    let accentGrid: boolean[][] = [];
    let densityMap: number[][] = [];

    const initGrid = () => {
      const rect = canvas.getBoundingClientRect();

      canvas.width = rect.width;
      canvas.height = rect.height;

      cols = Math.floor(canvas.width / STEP);
      rows = Math.floor(canvas.height / STEP);

      grid = Array(cols)
        .fill(0)
        .map(() => Array(rows).fill(0) as number[]);
      accentGrid = Array(cols)
        .fill(0)
        .map(() => Array(rows).fill(false) as boolean[]);

      const denseRows = 15;

      densityMap = Array(cols)
        .fill(0)
        .map(() =>
          Array(rows)
            .fill(0)
            .map((_, y) => {
              const fromBottom = rows - 1 - y;

              if (fromBottom < denseRows) return 1.0;

              const fade =
                1 - (fromBottom - denseRows) / Math.max(rows - denseRows, 1);

              return Math.max(0, fade * fade);
            })
        );
    };

    const tick = () => {
      if (!ctx || !canvas) return;

      ctx.fillStyle = 'rgba(13, 14, 18, 0.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          const density = densityMap[x][y];

          if (density <= 0.05) continue;

          if (Math.random() < 0.012 * density) {
            const alive = Math.random() > 0.45;

            grid[x][y] = alive ? Math.random() * 0.7 + 0.3 : 0;
            accentGrid[x][y] = alive && Math.random() < 0.06;
          }

          if (grid[x][y] > 0) {
            const alpha = grid[x][y] * density;

            ctx.fillStyle = accentGrid[x][y]
              ? `rgba(59,130,246,${alpha * 0.95})`
              : `rgba(255,255,255,${alpha * 0.28})`;

            ctx.fillRect(x * STEP, y * STEP, CELL_SIZE, CELL_SIZE);
          }
        }
      }

      tickTimeout = setTimeout(() => {
        rafId = requestAnimationFrame(tick);
      }, 80);
    };

    window.addEventListener('resize', initGrid);

    initGrid();

    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', initGrid);

      clearTimeout(tickTimeout);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      <div className={styles.vignetteVertical} />

      <div className={styles.vignetteHorizontal} />
    </div>
  );
};

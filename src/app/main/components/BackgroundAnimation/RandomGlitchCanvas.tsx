import React, { useEffect, useRef } from 'react';
import styles from './RandomGlitchCanvas.module.scss';

export const RandomGlitchCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let timeoutId: ReturnType<typeof setTimeout>;

    // Сеттингс
    const cellSize = 5;
    const gap = 3;
    const step = cellSize + gap;

    let cols = 0;
    let rows = 0;
    let grid: number[][] = [];
    let densityMap: number[][] = [];

    const initGrid = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      cols = Math.floor(canvas.width / step);
      rows = Math.floor(canvas.height / step);

      grid = Array(cols)
        .fill(0)
        .map(() => Array(rows).fill(0) as number[]);

      densityMap = Array(cols)
        .fill(0)
        .map((_, x) =>
          Array(rows)
            .fill(0)
            .map((_, y) => {
              const noise =
                Math.sin(x * 0.15) * Math.cos(y * 0.15) +
                Math.sin((x + y) * 0.05);
              if (noise > 0.8) return 1.0;
              if (noise > 0.2) return 0.4;
              return 0.0;
            })
        );
    };

    const draw = () => {
      if (!ctx || !canvas) return;

      ctx.fillStyle = 'rgba(13, 14, 18, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          const density = densityMap[x][y];

          if (density > 0) {
            if (Math.random() < 0.03 * density) {
              grid[x][y] = Math.random() > 0.5 ? Math.random() * 0.8 + 0.2 : 0;
            }

            if (grid[x][y] > 0) {
              ctx.fillStyle = `rgba(255, 255, 255, ${grid[x][y] * density})`;
              ctx.fillRect(x * step, y * step, cellSize, cellSize);
            }
          }
        }
      }

      timeoutId = setTimeout(() => {
        animationFrameId = requestAnimationFrame(draw);
      }, 50);
    };

    window.addEventListener('resize', initGrid);
    initGrid();
    draw();

    return () => {
      window.removeEventListener('resize', initGrid);
      clearTimeout(timeoutId);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.vignetteVertical} />
      <div className={styles.vignetteHorizontal} />
    </div>
  );
};

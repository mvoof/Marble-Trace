import { useEffect, useRef } from 'react';

import { isVisible, isEdge, computeMeatballCenters } from '../flags-utils';
import type { FlagType } from '../types';

import styles from './LedMatrix.module.scss';

const DIODE_SIZE = 8;
const DIODE_MARGIN = 1;
const DIODE_CELL = DIODE_SIZE + DIODE_MARGIN * 2;
const BLOCK_GAP = 3;
const BOARD_PADDING = 3;

export const BLOCK_PX = DIODE_CELL * 6 + BLOCK_GAP;

const FLAG_COLORS: Record<string, string> = {
  green: '#22ff00',
  yellow: '#ffe600',
  red: '#ff0a33',
  blue: '#0077ff',
  white: '#ffffff',
  orange: '#ff5500',
  off: '#16161a',
};

interface LedMatrixProps {
  blocksX: number;
  blocksY: number;
  cutoutWidth: number;
  cutoutHeight: number;
  flag: FlagType;
  blinkOn: boolean;
}

export const LedMatrix = ({
  blocksX,
  blocksY,
  cutoutWidth,
  cutoutHeight,
  flag,
  blinkOn,
}: LedMatrixProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const canvasWidth =
    blocksX * DIODE_CELL * 6 + (blocksX - 1) * BLOCK_GAP + BOARD_PADDING * 2;
  const canvasHeight =
    blocksY * DIODE_CELL * 6 + (blocksY - 1) * BLOCK_GAP + BOARD_PADDING * 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const meatball =
      flag === 'meatball'
        ? computeMeatballCenters(blocksX, blocksY, cutoutWidth, cutoutHeight)
        : null;

    const shouldBlink = flag === 'yellow' || flag === 'red';
    const isOff = flag === 'none' || (shouldBlink && !blinkOn);

    const buckets = new Map<string, { px: number; py: number }[]>();

    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        for (let dy = 0; dy < 6; dy++) {
          for (let dx = 0; dx < 6; dx++) {
            const gx = bx * 6 + dx;
            const gy = by * 6 + dy;

            if (
              !isVisible(gx, gy, blocksX, blocksY, cutoutWidth, cutoutHeight)
            ) {
              continue;
            }

            const color = isOff
              ? FLAG_COLORS.off
              : getDiodeColor(
                  gx,
                  gy,
                  bx,
                  by,
                  flag,
                  blocksX,
                  blocksY,
                  cutoutWidth,
                  cutoutHeight,
                  meatball
                );

            const px =
              BOARD_PADDING +
              bx * (DIODE_CELL * 6 + BLOCK_GAP) +
              dx * DIODE_CELL +
              DIODE_MARGIN;
            const py =
              BOARD_PADDING +
              by * (DIODE_CELL * 6 + BLOCK_GAP) +
              dy * DIODE_CELL +
              DIODE_MARGIN;

            let bucket = buckets.get(color);
            if (!bucket) {
              bucket = [];
              buckets.set(color, bucket);
            }
            bucket.push({ px, py });
          }
        }
      }
    }

    for (const [color, diodes] of buckets) {
      const isActive = color !== FLAG_COLORS.off;

      ctx.shadowBlur = isActive ? 8 : 0;
      ctx.shadowColor = isActive ? color : 'transparent';
      ctx.fillStyle = color;

      ctx.beginPath();
      for (const { px, py } of diodes) {
        ctx.roundRect(px, py, DIODE_SIZE, DIODE_SIZE, 1);
      }
      ctx.fill();
    }
  }, [
    blocksX,
    blocksY,
    cutoutWidth,
    cutoutHeight,
    flag,
    blinkOn,
    canvasWidth,
    canvasHeight,
  ]);

  return <canvas ref={canvasRef} className={styles.canvas} />;
};

function getDiodeColor(
  x: number,
  y: number,
  _bx: number,
  _by: number,
  flag: FlagType,
  blocksX: number,
  blocksY: number,
  cutW: number,
  cutH: number,
  meatball: ReturnType<typeof computeMeatballCenters> | null
): string {
  switch (flag) {
    case 'green':
      return FLAG_COLORS.green;

    case 'yellow':
      return FLAG_COLORS.yellow;

    case 'red':
      return FLAG_COLORS.red;

    case 'white':
      return FLAG_COLORS.white;

    case 'blue':
      return Math.floor((x + y) / 6) % 2 === 0
        ? FLAG_COLORS.blue
        : FLAG_COLORS.yellow;

    case 'checkered':
      return (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0
        ? FLAG_COLORS.white
        : FLAG_COLORS.off;

    case 'debris':
      return Math.floor(x / 3) % 2 === 0 ? FLAG_COLORS.yellow : FLAG_COLORS.red;

    case 'black':
      return isEdge(x, y, blocksX, blocksY, cutW, cutH)
        ? FLAG_COLORS.white
        : FLAG_COLORS.off;

    case 'meatball': {
      if (isEdge(x, y, blocksX, blocksY, cutW, cutH)) return FLAG_COLORS.white;
      if (!meatball) return FLAG_COLORS.off;
      const { cx1, cy1, cx2, cy2, radiusSq } = meatball;
      const dx1 = x - cx1;
      const dy1 = y - cy1;
      const dx2 = x - cx2;
      const dy2 = y - cy2;
      if (
        dx1 * dx1 + dy1 * dy1 <= radiusSq ||
        dx2 * dx2 + dy2 * dy2 <= radiusSq
      ) {
        return FLAG_COLORS.orange;
      }
      return FLAG_COLORS.off;
    }

    default:
      return FLAG_COLORS.off;
  }
}

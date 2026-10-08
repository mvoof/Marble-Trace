export const BLOCKS = 3;
export const MIN_SINGLE_LED_PX = 40;

const DIODE_CELL_PX = 12;
const BOARD_PADDING_PX = 4;
const BLOCK_GAP_PX = 4;

export interface DiodeData {
  gx: number;
  gy: number;
  bx: number;
  by: number;
  isCorner: boolean;
  key: string;
}

export interface BlockData {
  bx: number;
  by: number;
  diodes: DiodeData[];
  key: string;
}

export const computeDiodesPerBlock = (containerSize: number): number => {
  const available =
    containerSize - BOARD_PADDING_PX * 2 - BLOCK_GAP_PX * (BLOCKS - 1);
  return Math.max(
    1,
    Math.min(12, Math.floor(available / (BLOCKS * DIODE_CELL_PX)))
  );
};

export const computeSplitRows = (containerHeight: number): number => {
  const available = containerHeight - BOARD_PADDING_PX * 2;
  return Math.max(3, Math.floor(available / DIODE_CELL_PX));
};

export const buildGridData = (
  dpbX: number,
  dpbY: number,
  widthBlocks: number = 3,
  heightBlocks: number = 3,
  split: boolean = false
): BlockData[] => {
  const blocks: BlockData[] = [];
  const lastX = widthBlocks * dpbX - 1;
  const lastY = heightBlocks * dpbY - 1;

  for (let by = 0; by < heightBlocks; by++) {
    for (let bx = 0; bx < widthBlocks; bx++) {
      const diodes: DiodeData[] = [];

      for (let dy = 0; dy < dpbY; dy++) {
        for (let dx = 0; dx < dpbX; dx++) {
          const gx = bx * dpbX + dx;
          const gy = by * dpbY + dy;
          const isCorner =
            !split &&
            ((gx === 0 && gy === 0) ||
              (gx === lastX && gy === 0) ||
              (gx === 0 && gy === lastY) ||
              (gx === lastX && gy === lastY));

          diodes.push({ gx, gy, bx, by, isCorner, key: `${gx}-${gy}` });
        }
      }

      blocks.push({ bx, by, diodes, key: `${bx}-${by}` });
    }
  }

  return blocks;
};

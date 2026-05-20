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

export const computeDiodesPerBlock = (containerWidth: number): number => {
  const available =
    containerWidth - BOARD_PADDING_PX * 2 - BLOCK_GAP_PX * (BLOCKS - 1);
  return Math.max(
    1,
    Math.min(6, Math.floor(available / (BLOCKS * DIODE_CELL_PX)))
  );
};

export const buildGridData = (dpb: number): BlockData[] => {
  const blocks: BlockData[] = [];
  const last = BLOCKS * dpb - 1;

  for (let by = 0; by < BLOCKS; by++) {
    for (let bx = 0; bx < BLOCKS; bx++) {
      const diodes: DiodeData[] = [];

      for (let dy = 0; dy < dpb; dy++) {
        for (let dx = 0; dx < dpb; dx++) {
          const gx = bx * dpb + dx;
          const gy = by * dpb + dy;
          const isCorner =
            (gx === 0 && gy === 0) ||
            (gx === last && gy === 0) ||
            (gx === 0 && gy === last) ||
            (gx === last && gy === last);

          diodes.push({ gx, gy, bx, by, isCorner, key: `${gx}-${gy}` });
        }
      }

      blocks.push({ bx, by, diodes, key: `${bx}-${by}` });
    }
  }

  return blocks;
};

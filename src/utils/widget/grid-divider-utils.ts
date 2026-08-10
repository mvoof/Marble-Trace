export interface CellDividers {
  right: boolean;
  top: boolean;
}

// Hairlines live on the inner edges of a grid only, so the outer frame stays clean.
export const getCellDividers = (
  index: number,
  cols: number,
  total: number
): CellDividers => {
  const isLastColumn = (index + 1) % cols === 0;
  const isLastCell = index === total - 1;

  return {
    right: !isLastColumn && !isLastCell,
    top: index >= cols,
  };
};

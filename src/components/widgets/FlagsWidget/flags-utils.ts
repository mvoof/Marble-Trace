export function isVisible(
  x: number,
  y: number,
  blocksX: number,
  blocksY: number,
  cutW: number,
  cutH: number
): boolean {
  const w = blocksX * 6;
  const h = blocksY * 6;

  if (x < 0 || x >= w || y < 0 || y >= h) return false;

  if (
    (x === 0 && y === 0) ||
    (x === w - 1 && y === 0) ||
    (x === 0 && y === h - 1) ||
    (x === w - 1 && y === h - 1)
  ) {
    return false;
  }

  if (cutW > 0 && cutH > 0) {
    const bx = Math.floor(x / 6);
    const by = Math.floor(y / 6);
    const startBx = Math.floor((blocksX - cutW) / 2);
    const endBx = startBx + cutW;

    if (bx >= startBx && bx < endBx && by < cutH) return false;
  }

  return true;
}

export function isEdge(
  x: number,
  y: number,
  blocksX: number,
  blocksY: number,
  cutW: number,
  cutH: number
): boolean {
  if (!isVisible(x, y, blocksX, blocksY, cutW, cutH)) return false;
  return (
    !isVisible(x - 1, y, blocksX, blocksY, cutW, cutH) ||
    !isVisible(x + 1, y, blocksX, blocksY, cutW, cutH) ||
    !isVisible(x, y - 1, blocksX, blocksY, cutW, cutH) ||
    !isVisible(x, y + 1, blocksX, blocksY, cutW, cutH)
  );
}

interface MeatballCenters {
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;
  radiusSq: number;
}

export function computeMeatballCenters(
  blocksX: number,
  blocksY: number,
  cutW: number,
  cutH: number
): MeatballCenters {
  const w = blocksX * 6;
  const h = blocksY * 6;

  let cx1 = w / 2 - 0.5;
  let cy1 = h / 2 - 0.5;
  let cx2 = cx1;
  let cy2 = cy1;
  let radiusSq = 6.5 * 6.5;

  const isSplit = cutH >= blocksY && cutW > 0;

  if (isSplit) {
    const leftW = Math.floor((blocksX - cutW) / 2) * 6;
    const rightW = Math.ceil((blocksX - cutW) / 2) * 6;
    if (leftW > 0) cx1 = leftW / 2 - 0.5;
    if (rightW > 0) cx2 = w - rightW / 2 - 0.5;
    cy1 = h / 2 - 0.5;
    cy2 = cy1;
    radiusSq = Math.max(4, Math.pow(Math.min(6.5, leftW / 2 - 1.5), 2));
  } else if (cutH > 0) {
    cy1 = (cutH * 6 + h) / 2 - 0.5;
    cy2 = cy1;
    const bridgeH = h - cutH * 6;
    radiusSq = Math.max(4, Math.pow(Math.min(6.5, bridgeH / 2 - 1.5), 2));
  }

  return { cx1, cy1, cx2, cy2, radiusSq };
}

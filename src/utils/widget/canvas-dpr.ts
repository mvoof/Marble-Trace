/**
 * Sizes a canvas' backing store to the display density and returns its context
 * already scaled, so every draw call works in CSS pixels.
 *
 * Assigning `width`/`height` resets the context transform, so the scale is
 * re-applied on every resize — and only then, since a redundant assignment
 * clears the canvas.
 */
export const resizeCanvasToDpr = (
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number
): CanvasRenderingContext2D | null => {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  const dpr = window.devicePixelRatio || 1;
  const deviceWidth = Math.round(cssWidth * dpr);
  const deviceHeight = Math.round(cssHeight * dpr);

  if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
    canvas.width = deviceWidth;
    canvas.height = deviceHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  return ctx;
};

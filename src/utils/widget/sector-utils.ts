// Golden angle rotation ensures maximum perceptual distance between consecutive hues
const GOLDEN_ANGLE_DEG = 137.508;

export const getSectorColor = (index: number): string => {
  const hue = (index * GOLDEN_ANGLE_DEG) % 360;

  return `hsl(${hue.toFixed(1)}, 40%, 50%)`;
};

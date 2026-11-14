import type { LayoutMonitor } from '@shared/contracts/widget-settings';

/**
 * The number each attached monitor goes by in the editor's map and on its
 * Identify flash: the primary is 1, the rest follow left to right, a stack
 * top to bottom. Read from the arrangement alone, so a monitor keeps its
 * number for as long as nothing is moved.
 */
export const numberMonitors = (
  monitors: readonly Pick<LayoutMonitor, 'name' | 'bounds'>[],
  primaryName: string | null
): Map<string, number> => {
  const ordered = [...monitors].sort((first, second) => {
    const isFirstPrimary = first.name === primaryName;
    const isSecondPrimary = second.name === primaryName;

    if (isFirstPrimary !== isSecondPrimary) {
      return isFirstPrimary ? -1 : 1;
    }

    return first.bounds.x - second.bounds.x || first.bounds.y - second.bounds.y;
  });

  return new Map(ordered.map((monitor, index) => [monitor.name, index + 1]));
};

// Widgets whose plate is not a plain rounded rectangle need the frame that
// hosts them (overlay container, widget preview, layout editor) to clip with
// a matching border-radius. Shared here so every frame renders the same shape.
export const widgetFrameBorderRadius = (
  widgetId: string,
  userSettings: Record<string, unknown>
): string | undefined => {
  if (widgetId === 'input-trace' && userSettings.showSteering === true) {
    return `calc(12px * var(--wfs, 1)) 9999px 9999px calc(12px * var(--wfs, 1))`;
  }

  if (widgetId === 'race-dash') {
    return `calc(52px * var(--wfs, 1)) calc(14px * var(--wfs, 1)) calc(14px * var(--wfs, 1)) calc(52px * var(--wfs, 1))`;
  }

  return undefined;
};

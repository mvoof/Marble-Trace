import type { TelemetryEventName } from '@/types/telemetry-events';
import type { WidgetManifest } from '@/types/widget-settings';
import { WIDGETS } from '@store/widget-catalog';

/**
 * The bundle fields that change on every tick — the four at 60 Hz and the three
 * heavy per-car frames at 10 Hz. `incidents` is demand-gated too but changes
 * only when someone crashes, so it is not hot and carries no budget.
 *
 * The list is the one in `docs/rendering.md`, and it is what decides which
 * widgets fall under a render budget.
 */
export const HOT_TELEMETRY_FIELDS = [
  'carDynamics',
  'carInputs',
  'carPositions',
  'lapDelta',
  'driverEntries',
  'relative',
  'proximity',
] as const satisfies readonly TelemetryEventName[];

export type HotTelemetryField = (typeof HOT_TELEMETRY_FIELDS)[number];

const isHotField = (event: TelemetryEventName): event is HotTelemetryField =>
  (HOT_TELEMETRY_FIELDS as readonly TelemetryEventName[]).includes(event);

export const hotFieldsOf = (manifest: WidgetManifest): HotTelemetryField[] =>
  (manifest.telemetryEvents ?? []).filter(isHotField);

/**
 * The population under budget, derived from what the manifests declare rather
 * than from a list anyone has to keep in step. A widget that later declares a
 * hot field joins it without anyone remembering.
 */
export const HOT_WIDGET_IDS: string[] = WIDGETS.filter(
  (manifest) => hotFieldsOf(manifest).length > 0
).map((manifest) => manifest.id);

import type {
  WidgetDefaultConfig,
  WidgetUserSettings,
} from '@/types/widget-settings';

/**
 * The shape shared by the two widget maps: a set of widget configurations
 * addressed by copy id, readable and mutable.
 *
 * `LiveWidgetsStore` is the live map — the projection of the active layout
 * record. `WidgetDefaultsStore` is the catalogue a new layout is seeded from.
 * They are unrelated classes that a caller holding either one uses the same
 * way, so the shape is declared once here and both state they satisfy it: a
 * member removed from one, or re-signed in only one, fails the typecheck
 * instead of surfacing at a call site.
 *
 * The change counter is deliberately not a member. The two report it from
 * different places — the catalogue owns its own `changeToken`, the live map
 * reads the shared mutation log — and a caller that needs to react reads the
 * owner rather than the map.
 */
export interface WidgetMap {
  /** Every widget copy in the map, keyed by copy id. */
  readonly widgets: ReadonlyMap<string, WidgetDefaultConfig>;

  /** The copies whose telemetry the connected sim can actually provide. */
  readonly availableWidgetIds: string[];

  getWidget(id: string): WidgetDefaultConfig | undefined;

  updateUserSettings(id: string, partial: Partial<WidgetUserSettings>): void;

  /** Hydration: install a saved list over the shipped defaults. */
  setWidgets(widgets: WidgetDefaultConfig[]): void;
}

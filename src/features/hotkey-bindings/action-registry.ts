import { APP_OWNER, type BindingMap } from '@shared/contracts/input-bindings';
import type { HotkeyAction } from '@features/hotkey-bindings/binding-types';
import {
  STATIC_ACTIONS,
  widgetVisibilityAction,
} from '@features/hotkey-bindings/actions';

/** What the registry needs to know about a widget: its id, and its display name. */
export interface ActionOwnerWidget {
  id: string;
  label: string;
}

/**
 * The actions this build knows, assembled once from the widget catalog.
 *
 * Built explicitly rather than exported as a module constant: the per-widget
 * visibility actions are generated from the catalog, and a module-level
 * `ACTIONS` would force every importer to pull the catalog in at import time —
 * which is what kept the catalog from being handed to the root instead.
 *
 * There is exactly one instance per app window, built with its `BindingsStore`
 * (`buildAppWindowStores`); everything else reads it from there.
 */
export class ActionRegistry {
  readonly actions: HotkeyAction[];
  readonly byId: Map<string, HotkeyAction>;

  /**
   * Owner ids in the order the settings UI shows them: Application, then the
   * widgets that actually have bindable actions.
   */
  readonly owners: string[];

  /** The bindings an untouched install ships with. */
  readonly defaultBindings: BindingMap;

  private readonly widgetLabels: Map<string, string>;

  constructor(widgets: ActionOwnerWidget[]) {
    const widgetIds = widgets.map((widget) => widget.id);

    this.widgetLabels = new Map(
      widgets.map((widget) => [widget.id, widget.label])
    );

    // Adding a widget to a layout is the layout editor's job, so there is
    // deliberately no "put this widget into the layout" binding here.
    this.actions = [
      ...STATIC_ACTIONS,
      ...widgetIds.map(widgetVisibilityAction),
    ];

    this.byId = new Map(this.actions.map((action) => [action.id, action]));

    this.owners = [
      APP_OWNER,
      ...widgetIds.filter((widgetId) =>
        this.actions.some((action) => action.owner === widgetId)
      ),
    ];

    this.defaultBindings = {};

    for (const action of this.actions) {
      if (action.defaultBinding) {
        this.defaultBindings[action.id] = [action.defaultBinding];
      }
    }
  }

  /**
   * Display name of an owner: the widget's label, or the raw id for an owner
   * the catalog does not know. `APP_OWNER` is translated by the caller — it is
   * the one owner that is not a widget.
   */
  widgetLabel(owner: string): string {
    return this.widgetLabels.get(owner) ?? owner;
  }

  actionsForOwner(owner: string): HotkeyAction[] {
    return this.actions.filter((action) => action.owner === owner);
  }
}

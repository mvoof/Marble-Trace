import type { HotkeyActionSpec } from '@shared/contracts/bindings';
import {
  HOTKEY_ACTIONS,
  WIDGET_VISIBILITY_ACTION_PREFIX,
  WIDGET_VISIBILITY_ACTION_SUFFIX,
} from '@shared/contracts/hotkey-actions';
import type { HotkeyAction } from './binding-types';

/**
 * What the settings window adds to an action the backend declares: a hint for
 * a key that would currently change nothing.
 */
type InertRule = Required<Pick<HotkeyAction, 'isInert' | 'inertHintKey'>>;

const INERT_RULES: Record<string, InertRule> = {
  // With both auto switches off there is no auto mode to hand the stop to, so
  // the key would toggle a flag nothing reads.
  'pit-service:auto-mode': {
    isInert: (root) =>
      !root.pitServiceWidget.auto.isAutoFuelEnabled &&
      !root.pitServiceWidget.auto.isAutoTiresEnabled,
    inertHintKey: 'pitServiceAutoMode',
  },
};

const fromSpec = (spec: HotkeyActionSpec): HotkeyAction => ({
  id: spec.id,
  owner: spec.owner,
  labelKey: spec.labelKey,
  kind: spec.kind,
  trigger: spec.trigger,
  defaultBinding: spec.defaultBinding ?? undefined,
  ...INERT_RULES[spec.id],
});

export const widgetVisibilityActionId = (widgetId: string) =>
  `${WIDGET_VISIBILITY_ACTION_PREFIX}${widgetId}${WIDGET_VISIBILITY_ACTION_SUFFIX}`;

/** The widget a visibility action shows and hides, or null for any other id. */
export const visibilityActionWidget = (actionId: string): string | null => {
  if (
    !actionId.startsWith(WIDGET_VISIBILITY_ACTION_PREFIX) ||
    !actionId.endsWith(WIDGET_VISIBILITY_ACTION_SUFFIX)
  ) {
    return null;
  }

  const widgetId = actionId.slice(
    WIDGET_VISIBILITY_ACTION_PREFIX.length,
    -WIDGET_VISIBILITY_ACTION_SUFFIX.length
  );

  return widgetId === '' ? null : widgetId;
};

/**
 * One show/hide binding per widget, generated from the widget list so it stays
 * in step without a second hand-maintained table. The backend recognises it by
 * the shape of its id.
 *
 * Showing and hiding IS `enabled` in the layout: switching it off keeps the
 * widget's position and every setting, it just stops drawing. A second,
 * runtime-only notion of "hidden" would be the same state stored twice, and the
 * copy the editor could not see.
 *
 * This is the one action allowed past the layout gate, because it acts on the
 * layout rather than on the widget: the gate exists so a widget that is not on
 * screen does nothing — no broadcasts, no pit orders — and a key that puts it
 * back on screen is not the widget doing anything.
 *
 * Pit service gets one too, and it does not collide with `pit-service:toggle`:
 * that one pops the order box up away from the pit lane so a stop can be built
 * by hand, which only means anything while the widget is in the layout. Being
 * in the layout and being on screen right now are two different questions.
 */
export const widgetVisibilityAction = (widgetId: string): HotkeyAction => ({
  id: widgetVisibilityActionId(widgetId),
  owner: widgetId,
  labelKey: 'widgetToggleVisibility',
  kind: 'settings',
  trigger: 'press',
  ignoreLayoutGate: true,
});

/** Everything that does not depend on which widgets the build ships. */
export const STATIC_ACTIONS: HotkeyAction[] = HOTKEY_ACTIONS.map(fromSpec);

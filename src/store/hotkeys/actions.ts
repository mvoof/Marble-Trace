import {
  emitPitServiceToggle,
  emitStandingsScroll,
} from '@platform/services/events.service';
import { APP_OWNER } from '@/types/input-bindings';
import type { HotkeyAction } from './binding-types';

// One keypress moves the standings by a small block rather than a single row —
// a hotkey has no inertia, so row-by-row stepping is too slow to be usable.
const SCROLL_STEP_ROWS = 3;

const keyboard = (accelerator: string) =>
  ({ kind: 'keyboard', accelerator }) as const;

const APP_ACTIONS: HotkeyAction[] = [
  {
    id: 'app:toggle-drag-mode',
    owner: APP_OWNER,
    labelKey: 'toggleDragMode',
    trigger: 'press',
    defaultBinding: keyboard('F9'),
    run: (root) => root.appSettings.toggleDragMode(),
  },
  {
    // Whether the key toggles or is held is a property of the action, not of
    // the binding, so it stays in appSettings and is read here.
    id: 'app:toggle-interact-mode',
    owner: APP_OWNER,
    labelKey: 'toggleInteractMode',
    trigger: 'hold',
    defaultBinding: keyboard('F8'),
    run: (root, pressed) => {
      if (root.appSettings.appSettings.interactHotkeyMode === 'hold') {
        root.appSettings.setInteractMode(pressed);

        return;
      }

      if (pressed) {
        root.appSettings.toggleInteractMode();
      }
    },
  },
  {
    id: 'app:toggle-hide-all-widgets',
    owner: APP_OWNER,
    labelKey: 'toggleHideAllWidgets',
    trigger: 'press',
    defaultBinding: keyboard('F10'),
    run: (root) => root.appSettings.toggleHideAllWidgets(),
  },
];

const countStandingsClasses = (
  entries: Array<{ carClassId: number }> | undefined
) => new Set((entries ?? []).map((entry) => entry.carClassId)).size;

const STANDINGS_ACTIONS: HotkeyAction[] = [
  {
    id: 'standings:cycle-view-mode',
    owner: 'standings',
    labelKey: 'standingsCycleViewMode',
    trigger: 'press',
    run: (root) => root.widgetSettings.cycleStandingsViewMode(),
  },
  {
    id: 'standings:class-prev',
    owner: 'standings',
    labelKey: 'standingsClassPrev',
    trigger: 'press',
    run: (root) =>
      root.standingsWidget.cyclePrev(
        countStandingsClasses(root.backendComputed.standings?.entries)
      ),
  },
  {
    id: 'standings:class-next',
    owner: 'standings',
    labelKey: 'standingsClassNext',
    trigger: 'press',
    run: (root) =>
      root.standingsWidget.cycleNext(
        countStandingsClasses(root.backendComputed.standings?.entries)
      ),
  },
  {
    id: 'standings:scroll-up',
    owner: 'standings',
    labelKey: 'standingsScrollUp',
    trigger: 'press',
    run: () => void emitStandingsScroll(-SCROLL_STEP_ROWS),
  },
  {
    id: 'standings:scroll-down',
    owner: 'standings',
    labelKey: 'standingsScrollDown',
    trigger: 'press',
    run: () => void emitStandingsScroll(SCROLL_STEP_ROWS),
  },
];

const PIT_SERVICE_ACTIONS: HotkeyAction[] = [
  {
    id: 'pit-service:toggle',
    owner: 'pit-service',
    labelKey: 'pitServiceToggle',
    trigger: 'press',
    defaultBinding: keyboard('F7'),
    run: (root) => {
      root.pitServiceWidget.panel.toggleManualShow();
      void emitPitServiceToggle();
    },
  },
  {
    // Auto mode itself is switched on by the auto fuel / auto tires settings;
    // this action only decides who owns the stop that is happening right now.
    id: 'pit-service:auto-mode',
    owner: 'pit-service',
    labelKey: 'pitServiceAutoMode',
    trigger: 'press',
    // With both auto switches off there is no auto mode to hand the stop to,
    // so the key would toggle a flag nothing reads.
    isInert: (root) =>
      !root.pitServiceWidget.auto.isAutoFuelEnabled &&
      !root.pitServiceWidget.auto.isAutoTiresEnabled,
    inertHintKey: 'pitServiceAutoMode',
    run: (root) => root.pitServiceWidget.auto.toggleAutoSuspended(),
  },
  {
    id: 'pit-service:apply-order',
    owner: 'pit-service',
    labelKey: 'pitServiceApplyOrder',
    trigger: 'press',
    run: (root) => void root.pitServiceWidget.order.sendPlannedOrder(),
  },
  {
    id: 'pit-service:clear-order',
    owner: 'pit-service',
    labelKey: 'pitServiceClearOrder',
    trigger: 'press',
    run: (root) => void root.pitServiceWidget.order.sendClearOrder(),
  },
  {
    id: 'pit-service:fuel',
    owner: 'pit-service',
    labelKey: 'pitServiceFuel',
    trigger: 'press',
    run: (root) => void root.pitServiceWidget.order.toggleFuel(),
  },
  // The step follows the unit the driver reads — a liter, or a gallon's worth
  // of liters — so the number on the bar moves by what the key says it does.
  {
    id: 'pit-service:fuel-plus',
    owner: 'pit-service',
    labelKey: 'pitServiceFuelPlus',
    trigger: 'press',
    run: (root) =>
      void root.pitServiceWidget.order.adjustFuel(
        root.pitServiceWidget.order.fuelStepLiters
      ),
  },
  {
    id: 'pit-service:fuel-minus',
    owner: 'pit-service',
    labelKey: 'pitServiceFuelMinus',
    trigger: 'press',
    run: (root) =>
      void root.pitServiceWidget.order.adjustFuel(
        -root.pitServiceWidget.order.fuelStepLiters
      ),
  },
  {
    id: 'pit-service:tires-all',
    owner: 'pit-service',
    labelKey: 'pitServiceTiresAll',
    trigger: 'press',
    run: (root) => void root.pitServiceWidget.order.toggleAllTires(),
  },
  {
    id: 'pit-service:tire-lf',
    owner: 'pit-service',
    labelKey: 'pitServiceTireLf',
    trigger: 'press',
    run: (root) => void root.pitServiceWidget.order.toggleTire('lf'),
  },
  {
    id: 'pit-service:tire-rf',
    owner: 'pit-service',
    labelKey: 'pitServiceTireRf',
    trigger: 'press',
    run: (root) => void root.pitServiceWidget.order.toggleTire('rf'),
  },
  {
    id: 'pit-service:tire-lr',
    owner: 'pit-service',
    labelKey: 'pitServiceTireLr',
    trigger: 'press',
    run: (root) => void root.pitServiceWidget.order.toggleTire('lr'),
  },
  {
    id: 'pit-service:tire-rr',
    owner: 'pit-service',
    labelKey: 'pitServiceTireRr',
    trigger: 'press',
    run: (root) => void root.pitServiceWidget.order.toggleTire('rr'),
  },
  {
    id: 'pit-service:tire-compound',
    owner: 'pit-service',
    labelKey: 'pitServiceTireCompound',
    trigger: 'press',
    run: (root) => void root.pitServiceWidget.order.cycleTireCompound(),
  },
  {
    id: 'pit-service:fast-repair',
    owner: 'pit-service',
    labelKey: 'pitServiceFastRepair',
    trigger: 'press',
    run: (root) => void root.pitServiceWidget.order.toggleFastRepair(),
  },
  {
    id: 'pit-service:windshield',
    owner: 'pit-service',
    labelKey: 'pitServiceWindshield',
    trigger: 'press',
    run: (root) => void root.pitServiceWidget.order.toggleWindshield(),
  },
];

export const widgetVisibilityActionId = (widgetId: string) =>
  `widget:${widgetId}:toggle-visibility`;

/**
 * One show/hide binding per widget, generated from the widget list so it stays
 * in step without a second hand-maintained table.
 *
 * Showing and hiding IS `enabled` in the layout: switching it off keeps the
 * widget's position and every setting, it just stops drawing. A second,
 * runtime-only notion of "hidden" would be the same state stored twice, and the
 * copy the editor could not see.
 *
 * This is the one action allowed past the layout gate, because it acts on the
 * layout rather than on the widget: the gate exists so a widget that is not on
 * screen does nothing — no broadcasts, no automatic pit orders — and a key that
 * puts it back on screen is not the widget doing anything.
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
  trigger: 'press',
  ignoreLayoutGate: true,
  run: (root) => {
    const isEnabled =
      root.widgetSettings.getWidget(widgetId)?.userSettings.enabled === true;

    root.widgetSettings.setWidgetEnabled(widgetId, !isEnabled);
  },
});

/** Everything that does not depend on which widgets the build ships. */
export const STATIC_ACTIONS: HotkeyAction[] = [
  ...APP_ACTIONS,
  ...STANDINGS_ACTIONS,
  ...PIT_SERVICE_ACTIONS,
];

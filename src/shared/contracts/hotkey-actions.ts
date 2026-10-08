// Generated from Rust by `ts_values!` (src-tauri/src/model/ts_values.rs), the
// value generator that runs alongside specta's type export. Specta writes
// `bindings.ts` and only handles types; these are values, so they come from
// here. Edit the Rust declaration, not this file.

import type { HotkeyActionSpec } from '@shared/contracts/bindings';

/** Every bindable action but the generated per-widget visibility ones. */
export const HOTKEY_ACTIONS: readonly HotkeyActionSpec[] = [
  {
    "id": "app:toggle-drag-mode",
    "owner": "app",
    "labelKey": "toggleDragMode",
    "kind": "view",
    "trigger": "press",
    "defaultBinding": {
      "kind": "keyboard",
      "accelerator": "F9"
    }
  },
  {
    "id": "app:toggle-interact-mode",
    "owner": "app",
    "labelKey": "toggleInteractMode",
    "kind": "view",
    "trigger": "hold",
    "defaultBinding": {
      "kind": "keyboard",
      "accelerator": "F8"
    }
  },
  {
    "id": "app:toggle-hide-all-widgets",
    "owner": "app",
    "labelKey": "toggleHideAllWidgets",
    "kind": "settings",
    "trigger": "press",
    "defaultBinding": {
      "kind": "keyboard",
      "accelerator": "F10"
    }
  },
  {
    "id": "standings:cycle-view-mode",
    "owner": "standings",
    "labelKey": "standingsCycleViewMode",
    "kind": "settings",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "standings:class-prev",
    "owner": "standings",
    "labelKey": "standingsClassPrev",
    "kind": "view",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "standings:class-next",
    "owner": "standings",
    "labelKey": "standingsClassNext",
    "kind": "view",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "standings:scroll-up",
    "owner": "standings",
    "labelKey": "standingsScrollUp",
    "kind": "view",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "standings:scroll-down",
    "owner": "standings",
    "labelKey": "standingsScrollDown",
    "kind": "view",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "stream-chat:scroll-up",
    "owner": "stream-chat",
    "labelKey": "streamChatScrollUp",
    "kind": "view",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "stream-chat:scroll-down",
    "owner": "stream-chat",
    "labelKey": "streamChatScrollDown",
    "kind": "view",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "delta:cycle-reference",
    "owner": "delta",
    "labelKey": "deltaCycleReference",
    "kind": "settings",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "pit-service:toggle",
    "owner": "pit-service",
    "labelKey": "pitServiceToggle",
    "kind": "view",
    "trigger": "press",
    "defaultBinding": {
      "kind": "keyboard",
      "accelerator": "F7"
    }
  },
  {
    "id": "pit-service:auto-mode",
    "owner": "pit-service",
    "labelKey": "pitServiceAutoMode",
    "kind": "sim",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "pit-service:apply-order",
    "owner": "pit-service",
    "labelKey": "pitServiceApplyOrder",
    "kind": "sim",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "pit-service:clear-order",
    "owner": "pit-service",
    "labelKey": "pitServiceClearOrder",
    "kind": "sim",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "pit-service:fuel",
    "owner": "pit-service",
    "labelKey": "pitServiceFuel",
    "kind": "sim",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "pit-service:fuel-plus",
    "owner": "pit-service",
    "labelKey": "pitServiceFuelPlus",
    "kind": "sim",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "pit-service:fuel-minus",
    "owner": "pit-service",
    "labelKey": "pitServiceFuelMinus",
    "kind": "sim",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "pit-service:tires-all",
    "owner": "pit-service",
    "labelKey": "pitServiceTiresAll",
    "kind": "sim",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "pit-service:tire-lf",
    "owner": "pit-service",
    "labelKey": "pitServiceTireLf",
    "kind": "sim",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "pit-service:tire-rf",
    "owner": "pit-service",
    "labelKey": "pitServiceTireRf",
    "kind": "sim",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "pit-service:tire-lr",
    "owner": "pit-service",
    "labelKey": "pitServiceTireLr",
    "kind": "sim",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "pit-service:tire-rr",
    "owner": "pit-service",
    "labelKey": "pitServiceTireRr",
    "kind": "sim",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "pit-service:tire-compound",
    "owner": "pit-service",
    "labelKey": "pitServiceTireCompound",
    "kind": "sim",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "pit-service:fast-repair",
    "owner": "pit-service",
    "labelKey": "pitServiceFastRepair",
    "kind": "sim",
    "trigger": "press",
    "defaultBinding": null
  },
  {
    "id": "pit-service:windshield",
    "owner": "pit-service",
    "labelKey": "pitServiceWindshield",
    "kind": "sim",
    "trigger": "press",
    "defaultBinding": null
  }
];

/** `widget:<type>:toggle-visibility` — see `model/hotkeys.rs`. */
export const WIDGET_VISIBILITY_ACTION_PREFIX = "widget:";

export const WIDGET_VISIBILITY_ACTION_SUFFIX = ":toggle-visibility";

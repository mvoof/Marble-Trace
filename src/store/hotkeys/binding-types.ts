import type { HotkeyKind } from '@shared/contracts/bindings';
import type { Binding, BindingTrigger } from '@/types/input-bindings';
import type { PitServiceWidgetStore } from '@store/widgets/pit-service/pit-service.store';

/**
 * A bindable action as the settings window shows it. What it does is the
 * backend's: the dispatcher in `src-tauri/src/hotkeys/` catches the key and
 * runs it, and only a `settings` action comes back here to be applied
 * (`settings-actions.ts`).
 */
export interface HotkeyAction {
  /** Stable, persisted key. Never renamed once shipped. */
  id: string;
  /** Widget that owns the action, or APP_OWNER. Drives grouping and gating. */
  owner: string;
  /** i18n key under `bindings.actions` in main-app.json. */
  labelKey: string;
  kind: HotkeyKind;
  trigger: BindingTrigger;
  /** Shipped default; absent means the action starts unbound. */
  defaultBinding?: Binding;
  /**
   * Fires with its widget off screen — only the generated per-widget
   * visibility actions, whose whole job is to put the widget back.
   */
  ignoreLayoutGate?: boolean;
  /**
   * True when the action would run but change nothing, because a setting it
   * depends on is switched off. The layout gate covers "the widget is not
   * there"; this covers "the widget is there but this particular key has
   * nothing to act on", which is otherwise a silent no-op. Read by the
   * settings UI to draw the hint, so it may look at the core alone.
   */
  isInert?: (root: { pitServiceWidget: PitServiceWidgetStore }) => boolean;
  /** i18n key under `bindings.inert` explaining how to make the action work. */
  inertHintKey?: string;
}

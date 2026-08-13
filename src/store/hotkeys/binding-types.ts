import type { RootStore } from '@store/root-store';
import type { Binding, BindingTrigger } from '@/types/input-bindings';

export interface HotkeyAction {
  /** Stable, persisted key. Never renamed once shipped. */
  id: string;
  /** Widget that owns the action, or APP_OWNER. Drives grouping and gating. */
  owner: string;
  /** i18n key under `bindings.actions` in main-app.json. */
  labelKey: string;
  trigger: BindingTrigger;
  /** Shipped default; absent means the action starts unbound. */
  defaultBinding?: Binding;
  /**
   * `press` actions are called with `pressed === true` only.
   * `hold` actions are called on both edges.
   */
  run: (root: RootStore, pressed: boolean) => void;
  /**
   * Opt out of the "owner widget must be in the active layout" gate — used by
   * the per-widget `toggle-in-layout` actions, whose whole job is to add a
   * widget that is by definition not there yet.
   */
  ignoreLayoutGate?: boolean;
  /**
   * True when the action would run but change nothing, because a setting it
   * depends on is switched off. The layout gate covers "the widget is not
   * there"; this covers "the widget is there but this particular key has
   * nothing to act on", which is otherwise a silent no-op.
   */
  isInert?: (root: RootStore) => boolean;
  /** i18n key under `bindings.inert` explaining how to make the action work. */
  inertHintKey?: string;
}

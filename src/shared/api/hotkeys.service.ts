import { invoke } from '@tauri-apps/api/core';

import type { HotkeyContext, OverlayModes } from '@shared/contracts/bindings';
import type { BindingMap } from '@/types/input-bindings';

/**
 * The hotkey dispatcher lives in the backend (`src-tauri/src/hotkeys/`). These
 * tell it what to dispatch and own nothing themselves.
 */

/** The effective map — defaults with the overrides on top. */
export const setHotkeyBindings = async (bindings: BindingMap): Promise<void> =>
  invoke('set_hotkey_bindings', { bindings });

export const setHotkeyContext = async (context: HotkeyContext): Promise<void> =>
  invoke('set_hotkey_context', { context });

/** The overlay's mouse modes are the dispatcher's; a window asks for a change. */
export const requestDragMode = async (enabled: boolean): Promise<void> =>
  invoke('set_drag_mode', { enabled });

export const requestInteractMode = async (enabled: boolean): Promise<void> =>
  invoke('set_interact_mode', { enabled });

export const getOverlayModes = async (): Promise<OverlayModes> =>
  invoke('get_overlay_modes');

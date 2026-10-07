import type { RendererCore } from '@store/roots/renderer-core';
import type { WidgetInstanceStore } from '@store/widget-runtime/widget-instances.store';

/**
 * What a standings instance store answers to when a hotkey reaches the window.
 *
 * Declared here rather than taken from the store itself: the store lives with
 * its widget under `@ui/**`, and the sync layer that delivers the hotkey may
 * not import from there.
 */
export interface StandingsHotkeyTarget extends WidgetInstanceStore {
  /** One class forward (`1`) or back (`-1`), wrapping at either end. */
  stepClass(direction: number): void;
  scrollByRows(delta: number): void;
}

/**
 * The standings tables in this window a standings hotkey acts on: the mounted
 * instances marked for hotkeys. A table switched off for them keeps its own
 * class and scroll, so two tables on one screen can show different classes.
 */
export const standingsHotkeyTargets = (
  core: Pick<RendererCore, 'widgetInstances'>
): StandingsHotkeyTarget[] =>
  core.widgetInstances.hotkeyStoresOf<StandingsHotkeyTarget>('standings');

/** What a chat instance store answers to when the scroll hotkey reaches the window. */
export interface StreamChatHotkeyTarget extends WidgetInstanceStore {
  /** Positive lifts the view towards older messages. */
  scrollByRows(delta: number): void;
}

/** The chat windows in this window the scroll hotkey acts on. */
export const streamChatHotkeyTargets = (
  core: Pick<RendererCore, 'widgetInstances'>
): StreamChatHotkeyTarget[] =>
  core.widgetInstances.hotkeyStoresOf<StreamChatHotkeyTarget>('stream-chat');

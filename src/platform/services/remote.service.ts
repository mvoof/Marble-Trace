import { invoke } from '@tauri-apps/api/core';

import type { RemoteControlKind, RemoteScreenSnapshot } from '@/types/remote';
import type {
  RemoteDevice,
  RemoteServerConfig,
  RemoteServerInfo,
} from '@/types/bindings';

/**
 * The remote-widgets server. Everything here runs in the main window only —
 * an overlay window never starts, stops or feeds it.
 */

export const startRemoteServer = async (
  config: RemoteServerConfig
): Promise<RemoteServerInfo> => invoke('start_remote_server', { config });

export const stopRemoteServer = async (): Promise<void> =>
  invoke('stop_remote_server');

export const getRemoteServerInfo = async (): Promise<RemoteServerInfo> =>
  invoke('get_remote_server_info');

/** What the connected devices report about their own displays. */
export const getRemoteDevices = async (): Promise<RemoteDevice[]> =>
  invoke('get_remote_devices');

/** Hands one screen's layout to the server, which caches and forwards it. */
export const publishRemoteSnapshot = async (
  slug: string,
  snapshot: RemoteScreenSnapshot
): Promise<void> => invoke('publish_remote_snapshot', { slug, snapshot });

/**
 * Pushes one widget command to every connected remote screen.
 *
 * The overlay windows receive these as Tauri events, which stop at the app
 * boundary — a hotkey that scrolls the standings or turns the track map has to
 * travel this way to reach a browser. The backend whitelists the kinds.
 */
export const publishRemoteControl = async (
  kind: RemoteControlKind,
  data: unknown
): Promise<void> => invoke('publish_remote_control', { kind, data });

export const remoteScreenUrl = async (slug: string): Promise<string> =>
  invoke('remote_screen_url', { slug });

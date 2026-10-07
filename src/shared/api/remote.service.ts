import { invoke } from '@tauri-apps/api/core';

import type { RemoteControlKind } from '@shared/contracts/remote';
import type { ClientSnapshot } from '@shared/contracts/client-protocol';
import type {
  RemoteDevice,
  RemoteServerConfig,
  RemoteServerInfo,
} from '@shared/contracts/bindings';

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
  snapshot: ClientSnapshot
): Promise<void> => invoke('publish_remote_snapshot', { slug, snapshot });

/**
 * Pushes one signal to every connected remote screen — the same message the
 * overlays receive as a Tauri event, which stops at the app boundary. The
 * backend whitelists the kinds, and keeps the driver's own off the network.
 */
export const publishRemoteControl = async (
  kind: RemoteControlKind,
  data: unknown
): Promise<void> => invoke('publish_remote_control', { kind, data });

export const remoteScreenUrl = async (slug: string): Promise<string> =>
  invoke('remote_screen_url', { slug });

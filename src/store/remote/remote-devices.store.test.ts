import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RemoteServerInfo } from '@/types/bindings';
import { RemoteDevicesStore } from './remote-devices.store';

const getRemoteServerInfoMock = vi.hoisted(() => vi.fn());

vi.mock('@platform/services/remote.service', () => ({
  getRemoteServerInfo: getRemoteServerInfoMock,
}));

const POLL_MS = 3000;

const runningOn = (port: number) =>
  ({
    running: true,
    ip: '192.168.1.20',
    port,
    clientCount: 0,
  }) as RemoteServerInfo;

/** Lets the mocked command's promise settle. */
const settle = () => vi.advanceTimersByTimeAsync(0);

describe('RemoteDevicesStore — the server status', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getRemoteServerInfoMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks at once and then on every poll', async () => {
    getRemoteServerInfoMock.mockResolvedValue(runningOn(8080));
    const store = new RemoteDevicesStore();

    store.watchServerInfo();
    await settle();

    expect(store.serverInfo?.port).toBe(8080);

    getRemoteServerInfoMock.mockResolvedValue(runningOn(8081));
    await vi.advanceTimersByTimeAsync(POLL_MS);

    expect(store.serverInfo?.port).toBe(8081);
    expect(getRemoteServerInfoMock).toHaveBeenCalledTimes(2);
  });

  it('drops a reply that arrives after it stopped watching', async () => {
    let answer: (info: RemoteServerInfo) => void = () => undefined;
    getRemoteServerInfoMock.mockReturnValue(
      new Promise<RemoteServerInfo>((resolve) => {
        answer = resolve;
      })
    );
    const store = new RemoteDevicesStore();

    const stop = store.watchServerInfo();
    stop();
    answer(runningOn(8080));
    await settle();

    expect(store.serverInfo).toBeNull();

    await vi.advanceTimersByTimeAsync(POLL_MS);

    expect(getRemoteServerInfoMock).toHaveBeenCalledTimes(1);
  });

  it('reads a failed request as no server', async () => {
    getRemoteServerInfoMock.mockRejectedValue(new Error('not running'));
    const store = new RemoteDevicesStore();

    store.watchServerInfo();
    await settle();

    expect(store.serverInfo).toBeNull();
  });
});

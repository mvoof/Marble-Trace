import { makeAutoObservable, runInAction } from 'mobx';
import {
  resolveInputDevices,
  setInputPollingEnabled,
} from '@/services/input.service';
import type {
  InputButtonEvent,
  InputDevice,
  InputDeviceResolution,
} from '@/types/bindings';

/**
 * Data store: what the backend reports about game controllers. No derived
 * state and no timers — the runner and the capture modal both read it.
 *
 * `knownDevices` is persisted so a device that is unplugged still has a name to
 * show next to its bindings instead of a bare GUID.
 */
export class DeviceInputStore {
  devices: InputDevice[] = [];
  knownDevices: InputDevice[] = [];

  /** Last button edge seen, whatever the device. The capture modal reads it. */
  lastEvent: InputButtonEvent | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setKnownDevices(devices: InputDevice[]) {
    this.knownDevices = devices;
    this.devices = devices.map((device) => ({ ...device, connected: false }));
  }

  setDevices(devices: InputDevice[]) {
    this.devices = devices;
    this.knownDevices = devices;
  }

  setLastEvent(event: InputButtonEvent | null) {
    this.lastEvent = event;
  }

  deviceById(deviceId: string): InputDevice | undefined {
    return this.devices.find((device) => device.id === deviceId);
  }

  isDeviceConnected(deviceId: string): boolean {
    return this.deviceById(deviceId)?.connected === true;
  }

  get connectedDevices(): InputDevice[] {
    return this.devices.filter((device) => device.connected);
  }

  /**
   * Asks the backend what is attached, passing the devices worth remembering so
   * it can re-match one whose DirectInput GUID changed. Returns the id rewrites
   * the caller must apply to its bindings.
   *
   * `boundDeviceIds` is what keeps an unplugged device on screen: only devices
   * that still hold a binding survive being detached — anything else simply
   * disappears from the list, as a device the user never bound anything to
   * should.
   */
  async resolveDevices(
    boundDeviceIds: string[]
  ): Promise<InputDeviceResolution['remaps']> {
    const retained = new Set(boundDeviceIds);

    const known = this.knownDevices.filter((device) => retained.has(device.id));

    try {
      const resolution = await resolveInputDevices(known);

      runInAction(() => this.setDevices(resolution.devices));

      return resolution.remaps;
    } catch (error) {
      console.error('[bindings] failed to resolve input devices', error);

      return [];
    }
  }

  async setPollingEnabled(enabled: boolean) {
    try {
      await setInputPollingEnabled(enabled);
    } catch (error) {
      console.error('[bindings] failed to toggle input polling', error);
    }
  }

  reset() {
    this.devices = [];
    this.lastEvent = null;
  }
}

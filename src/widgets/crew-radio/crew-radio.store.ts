import { makeAutoObservable } from 'mobx';

import type {
  CrewRadioLine,
  CrewRadioStore,
} from '@entities/crew-radio/crew-radio.store';
import type { LiveWidgetsView } from '@entities/layout/live-widgets.store';
import type { WidgetInstanceContext } from '@entities/widget/widget-instances.store';
import { useWidgetInstanceStore } from '@entities/widget/widget-instance-context';
import type { SelfHidingWidgetStore } from '@features/widget-auto-hide/widget-auto-hide.store';
import { visibleCrewRadioLines } from './crew-radio-utils';
import type { CrewRadioWidgetSettings } from './settings-schema';

interface CrewRadioDeps {
  crewRadio: CrewRadioStore;
  liveWidgets: LiveWidgetsView;
}

/**
 * One Crew Radio plate: the lines its own settings keep. The radio itself —
 * the press, the lines, the moment it stays up after — is app-wide.
 */
export class CrewRadioWidgetStore implements SelfHidingWidgetStore {
  private readonly root: CrewRadioDeps;

  private readonly instanceId: string;

  constructor({ core, instanceId }: WidgetInstanceContext<CrewRadioDeps>) {
    this.root = core;
    this.instanceId = instanceId;

    makeAutoObservable<CrewRadioWidgetStore, 'root' | 'instanceId'>(this, {
      root: false,
      instanceId: false,
    });
  }

  // Nothing of its own to stop: the radio and its timer are app-wide.
  dispose() {}

  get settings(): CrewRadioWidgetSettings {
    return this.root.liveWidgets.getSettings<CrewRadioWidgetSettings>(
      this.instanceId
    );
  }

  /** Push-to-talk is down: the crew is listening. */
  get isListening(): boolean {
    return this.root.crewRadio.listening;
  }

  get lines(): CrewRadioLine[] {
    return visibleCrewRadioLines(
      this.root.crewRadio.lines,
      this.isListening,
      this.settings
    );
  }

  get isVisible(): boolean {
    return this.root.crewRadio.isActive;
  }
}

export const useCrewRadioWidgetStore = () =>
  useWidgetInstanceStore<CrewRadioWidgetStore>();

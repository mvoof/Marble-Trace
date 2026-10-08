import { beforeEach, describe, expect, it } from 'vitest';
import { runInAction } from 'mobx';
import { MainRoot } from '@app/roots/main-root';
import { readWidgetSettings } from './useWidgetSettings';

interface PitAssistSwitch {
  showPitAssist: boolean;
}

// The shift lights read the race dash's pit assist switch. Rendered inside
// their own instance, the context names a shift-lights copy — reading by that
// id found none of the race dash's keys, so the pit bar never came on.
describe('readWidgetSettings', () => {
  let root: MainRoot;

  beforeEach(() => {
    root = new MainRoot({ skipInit: true });
  });

  it('reads another widget through the instance that speaks for it', () => {
    runInAction(() => {
      root.liveWidgets.updateUserSettings('race-dash', {
        showPitAssist: false,
      });
    });

    const settings = readWidgetSettings<PitAssistSwitch>(
      root.liveWidgets,
      'rpm-lights',
      'race-dash'
    );

    expect(settings.showPitAssist).toBe(false);
  });

  it('reads its own copy when the copy is of the widget asked for', () => {
    runInAction(() => {
      root.liveWidgets.updateUserSettings('race-dash', {
        showPitAssist: false,
      });
    });

    const settings = readWidgetSettings<PitAssistSwitch>(
      root.liveWidgets,
      'race-dash',
      'race-dash'
    );

    expect(settings.showPitAssist).toBe(false);
  });

  it('falls back to the widget itself outside any instance', () => {
    const settings = readWidgetSettings<PitAssistSwitch>(
      root.liveWidgets,
      '',
      'race-dash'
    );

    expect(settings.showPitAssist).toBe(true);
  });
});

import { autorun, runInAction } from 'mobx';
import { describe, expect, it } from 'vitest';

import { MainRoot } from '@app/roots/main-root';

/**
 * A component reading one widget's settings is woken by writes to that widget
 * only — never by a drag or an edit of another one.
 */
describe('LiveWidgetsStore settings subscription', () => {
  const twoWidgets = () => {
    const root = new MainRoot({ skipInit: true });
    const [reader, other] = root.liveWidgets.allWidgets;

    return { root, readerId: reader.id, otherId: other.id };
  };

  const countRuns = (read: () => unknown) => {
    let runs = 0;

    const dispose = autorun(() => {
      read();
      runs++;
    });

    return { runs: () => runs, dispose };
  };

  it("is not woken by another widget's move", () => {
    const { root, readerId, otherId } = twoWidgets();
    const counter = countRuns(
      () => root.liveWidgets.getSettings(readerId).enabled
    );

    runInAction(() => {
      root.liveWidgets.updatePosition(otherId, 40, 40);
      root.liveWidgets.updateSize(otherId, 300, 200);
    });

    expect(counter.runs()).toBe(1);
    counter.dispose();
  });

  it("is not woken by another widget's settings edit", () => {
    const { root, readerId, otherId } = twoWidgets();
    const counter = countRuns(
      () => root.liveWidgets.getSettings(readerId).enabled
    );

    runInAction(() => {
      root.liveWidgets.updateUserSettings(otherId, { opacity: 50 });
    });

    expect(counter.runs()).toBe(1);
    counter.dispose();
  });

  it("is not woken by another widget's move when read by type", () => {
    const { root, readerId, otherId } = twoWidgets();
    const readerType = root.liveWidgets.getWidget(readerId)!.type;
    const counter = countRuns(
      () => root.liveWidgets.settingsOfType(readerType).enabled
    );

    runInAction(() => {
      root.liveWidgets.updatePosition(otherId, 40, 40);
      root.liveWidgets.updateUserSettings(otherId, { opacity: 50 });
    });

    expect(counter.runs()).toBe(1);
    counter.dispose();
  });

  it('is woken by its own widget', () => {
    const { root, readerId } = twoWidgets();
    const counter = countRuns(
      () => root.liveWidgets.getSettings(readerId).enabled
    );
    const wasEnabled = root.liveWidgets.getSettings(readerId).enabled;

    runInAction(() => {
      root.liveWidgets.updateUserSettings(readerId, { enabled: !wasEnabled });
    });

    expect(counter.runs()).toBe(2);
    counter.dispose();
  });
});

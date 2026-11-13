import { makeAutoObservable } from 'mobx';

export type MainSection = 'layouts' | 'widgets' | 'crew' | 'settings';

export type LayoutsMode = 'list' | 'editor';

/** A page, and what to open inside it. */
type Destination = { section: MainSection; widgetId?: string };

type MainNavigationDeps = {
  voiceCrew: { dirty: boolean };
  widgetDefaults: { catalogWidgets: readonly { id: string }[] };
};

/**
 * Which page of the main window is open, and what inside it. Any part of the
 * main window opens a page through here, so a deep link ("this widget") is a
 * store call rather than props threaded through the shell.
 */
export class MainNavigationStore {
  section: MainSection = 'layouts';

  /** The Layouts page's list or editor, kept while other pages are open. */
  layoutsMode: LayoutsMode = 'list';

  private chosenWidgetId: string | null = null;

  /** Where the user asked to go while the crew still holds unsaved edits. */
  private heldDestination: Destination | null = null;

  constructor(private readonly deps: MainNavigationDeps) {
    makeAutoObservable<this, 'deps'>(this, { deps: false }, { autoBind: true });
  }

  /** The chosen widget, or the first in the catalog until one is chosen. */
  get activeWidgetId(): string | null {
    return (
      this.chosenWidgetId ??
      this.deps.widgetDefaults.catalogWidgets[0]?.id ??
      null
    );
  }

  /** The crew's unsaved edits are saved or dropped before another page opens. */
  get isAskingToLeave(): boolean {
    return this.heldDestination !== null;
  }

  open(section: MainSection) {
    this.goTo({ section });
  }

  /** The widgets page, on this widget. */
  openWidget(widgetId: string) {
    this.goTo({ section: 'widgets', widgetId });
  }

  setLayoutsMode(mode: LayoutsMode) {
    this.layoutsMode = mode;
  }

  /** The user chose to keep editing the crew. */
  stay() {
    this.heldDestination = null;
  }

  /** The user chose to leave the crew's edits behind. */
  leave() {
    const destination = this.heldDestination;

    this.heldDestination = null;

    if (destination !== null) {
      this.arrive(destination);
    }
  }

  private goTo(destination: Destination) {
    const leavesUnsavedCrew =
      this.section === 'crew' &&
      destination.section !== 'crew' &&
      this.deps.voiceCrew.dirty;

    if (leavesUnsavedCrew) {
      this.heldDestination = destination;

      return;
    }

    this.arrive(destination);
  }

  private arrive(destination: Destination) {
    if (destination.widgetId !== undefined) {
      this.chosenWidgetId = destination.widgetId;
    }

    this.section = destination.section;
  }
}

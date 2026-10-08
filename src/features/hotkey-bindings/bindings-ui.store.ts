import { makeAutoObservable } from 'mobx';

/**
 * Presentation state of the Bindings settings section. Kept apart from
 * `BindingsStore`, which owns only the persisted registry.
 */
export class BindingsUiStore {
  search = '';

  /** Action the capture modal is currently binding to, or null when closed. */
  captureActionId: string | null = null;

  /** Waiting for a key or device button to search by, rather than to bind. */
  isSearchingByKey = false;

  /**
   * True when the current search text came from a key press. Lets the empty
   * state say "this key is free" instead of "nothing found", which is the
   * actual answer to "where is this key used?".
   */
  searchIsFromKey = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setSearch(value: string) {
    this.search = value;
    this.searchIsFromKey = false;
  }

  startKeySearch() {
    this.isSearchingByKey = true;
  }

  stopKeySearch() {
    this.isSearchingByKey = false;
  }

  /** Fills the search with what was just pressed and leaves listening mode. */
  setSearchFromKey(value: string) {
    this.search = value;
    this.searchIsFromKey = true;
    this.isSearchingByKey = false;
  }

  startCapture(actionId: string) {
    this.captureActionId = actionId;
  }

  cancelCapture() {
    this.captureActionId = null;
  }

  get isCapturing(): boolean {
    return this.captureActionId !== null;
  }
}

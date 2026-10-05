# ADR 0007: Main owns the settings; every other window is a client

**Status:** accepted, 2026-10-05
**Context:** the architecture rework, ticket 15 (design) → ticket 17
(implementation); spec → Decisions. Partly supersedes ADR-0002.

## Decision

The main window is the only holder of the settings and the only one that
writes them. Overlays and remote screens are **clients of one protocol**:

- main sends each client a **snapshot** of what that client draws, on every
  change;
- an overlay changes a setting only by sending main a **command**;
- a remote screen never sends one — the hub refuses commands from WS clients.

Main's own edits (the layout editor, the settings pages) stay direct writes to
its stores; only the other windows go through commands.

## Why

Today main and every overlay hold a MobX copy of the settings and both write.
Keeping the copies equal costs ~16 synced events, two tokens, an echo guard
across layout switches (`syncedLayoutId`), `applySettingsSyncForMonitor`, the
"assign directly, never via a setter" rule, and a full copy of the whole layout
in every overlay. It still loses data:

- an overlay sends back **whole widget records**, so a field main changed
  meanwhile is overwritten by the overlay's stale copy;
- two overlays adding the same widget from the F9 picker both name it
  `<type>-2` from their own copy of the layout; main reads the second as the
  first and drops it, because its monitor is not the sender's;
- two overlays saved the track-map rotation file read-modify-write (fixed by
  ticket 16, the first slice of this decision).

Remote screens already work the way this ADR describes — one snapshot per
screen, no write path — through a separate vocabulary. One protocol for both
removes the second path.

## What an overlay writes — the whole inventory

Taken from the code, not from memory (ticket 15). Nothing else in an overlay
writes a setting: settings-kind hotkeys (cycle view mode, delta reference,
toggle visibility) already run in main, drag and interact mode belong to the
backend, `copySettingsFrom`/`resetSettings` are only reached from the editor.

| gesture                  | today                                              | becomes               |
| ------------------------ | -------------------------------------------------- | --------------------- |
| drag                     | `WidgetContainer.tsx` `updatePosition`             | `setGeometry`         |
| resize                   | `WidgetContainer.tsx` `updateSize`+pos             | `setGeometry`         |
| snap                     | `SnapPanel.tsx` `updatePosition`                   | `setGeometry`         |
| switch off               | `WidgetDragToolbar.tsx` `setWidgetEnabled`         | `setEnabled`          |
| add from the F9 picker   | `WidgetPicker.tsx` `setTypeEnabledOnMonitor`       | `enableTypeOnMonitor` |
| any setting in the popup | `WidgetSettings.tsx` + panels `updateUserSettings` | `patchSettings`       |
| track-map rotation       | (ticket 16: already a step sent to main)           | —                     |

## Commands (overlay → main)

One command per **intent**, not a generic field patch: main runs the logic it
already has (clamping to the monitor, reuse-or-create from the template), and
that logic never leaks into a client.

| command               | payload                                  | main runs                       |
| --------------------- | ---------------------------------------- | ------------------------------- |
| `setGeometry`         | `widgetId, x, y, width?, height?, final` | `updatePosition` / `updateSize` |
| `setEnabled`          | `widgetId, enabled`                      | `setWidgetEnabled`              |
| `enableTypeOnMonitor` | `type, monitor`                          | `setTypeEnabledOnMonitor`       |
| `patchSettings`       | `widgetId, partial`                      | `updateUserSettings`            |

Every command also carries `commandNo` (the client's own counter, from 1) and
`layoutId`; main rejects a command whose `layoutId` is not the live layout.

- **Coalescing.** `patchSettings` for one widget is merged over 50 ms and the
  last value sent; `setGeometry` is sent every 50–100 ms during a drag or
  resize and once more on release with `final: true`, so a stream screen
  follows the drag instead of jumping. `setEnabled` and `enableTypeOnMonitor`
  go at once. The overlay draws its own value immediately (below), so the
  delay is only what the other screens see.
- **Ids are main's.** `enableTypeOnMonitor` names no id and is not shown in
  advance: main picks the instance — an existing one switched back on, or a
  new `<type>-<n>` placed by `spotForAddedWidget` — and the widget appears
  with the next snapshot, a few ms later. This keeps the id format and
  `widgetTypeFromId`, and removes the `<type>-2` collision.
- **No undo.** Commands are applied without an undo snapshot. F9 is quick
  adjustment before a race, not the editor; a user who dislikes a drag drags
  it back. Main applies them on a path that skips `pushUndo`.
- **The popup stays.** The settings popup in F9 keeps the same panels as main.
  Panels write through a writer taken from context: in main it calls the
  store, in an overlay it sends `patchSettings` and sets the override. The
  overlay root exposes no mutating method, so a forgotten write is a compile
  error.

## Snapshots (main → client)

A client receives a snapshot of **what it draws, and nothing else**:

- an overlay: its own monitor — the widgets on it, its bounds — plus the
  app-level state its widgets read: `hideAllWidgets`,
  `hideWidgetsWhenGameClosed`, a derived `hidesOffTrack` (today the overlay
  reads `autoSwitchLayouts` and `sessionLayouts.Garage` to compute it), units,
  steering lock, pit strategy, language, stream-chat filters, the binding
  overrides, the layout name, `settingsLocked`, and `lastHandledCommandNo`
  for that client;
- a remote screen: the same shape for its screen, without the command fields.

No patches: a snapshot replaces the client's state whole. Overlays get one on
every change (debounced 16 ms, as the full-layout push is today); remote
screens keep their 150 ms. An overlay no longer receives the other monitors —
it never moves a widget across monitors itself (`moveWidgetToMonitor` is the
editor's), and it no longer needs the layout to pick a free id.

Field-level patches are deferred behind measurement, as ADR-0006 did for a
binary transport: a single monitor is kilobytes.

## Acknowledgement

`lastHandledCommandNo` is the last command of that client main has **handled**
— accepted or rejected.

- Until `lastHandledCommandNo ≥ commandNo`, the overlay keeps an override of
  exactly the fields that command changed. An incoming snapshot is always
  applied; only those fields are masked.
- A rejection needs no path of its own: the snapshot carries main's value and
  the override is dropped like any other. The reason travels in
  `rejected: [{ commandNo, reason }]`, for the log only.
- No timeout. If main stops answering, the app is broken as a whole.

## Start and reload

An overlay starts by sending `hello { clientId }` (its window label,
`overlay-<monitor>`). Main resets that client's `lastHandledCommandNo` to 0
and answers with a snapshot. A reloaded overlay restarts its counter at 1, so
a stale number never acknowledges its new commands; unacknowledged commands
from before the reload are dropped, not resent.

The overlay no longer reads `settings.json` or runs the migration chain. Main
opens the overlays after its own hydration, so it is ready to answer.

## State vs signals

- **State** — anything a client must show after a reload — goes in the
  snapshot.
- **Signals** — `stream-chat-cleared`, the layout-activated toast, hotkey view
  controls, track-map clear, the track-map rotation — stay control messages in
  `RemoteControlKind`, the one vocabulary for overlays and remote screens.
  Overlay modes stay the backend's `app://overlay-modes`.

## Types

The envelope — `kind`, `clientId`, `commandNo`, `lastHandledCommandNo`,
`rejected` — is declared in Rust and exported through specta: the hub reads it
to refuse WS commands and to replay the last snapshot. Command and snapshot
payloads are TS-only types in `src/types/`; Rust forwards them opaquely.

## Consequences

Removed by ticket 17:

- `emitWidgetSettingsToMain`, the overlay → main `widget-settings-updated`,
  `applySettingsSyncForMonitor`, `drainTouchedWidgets`, `syncedLayoutId` and
  the echo handling around it;
- `syncToken` / `recordSynced` and the touched-widget set in
  `SettingsMutationLog` — **this supersedes ADR-0002** for everything but
  `changeToken`, which stays as main's save trigger;
- the overlay listeners `hide-all-widgets-changed`,
  `hide-widgets-when-game-closed-changed`, `units-changed`,
  `steering-lock-changed`, `pit-strategy-changed`, `language-changed`,
  `stream-chat-filters-changed`, `session-layouts-changed`,
  `auto-switch-layouts-changed`, `bindings-changed` and the main → overlay
  `widget-settings-updated` — all folded into the snapshot;
- the overlay's `readSettingsFile` / `hydrateFromDisk`;
- the "assign directly, never via a setter" rule.

Stays: main's save reactions on `changeToken`, `RemoteControlKind`, the
remote hub's replay, the drag and interact modes in the backend.

AGENTS.md "Cross-Window State Sync" and "Remote screens" are rewritten with
ticket 17, not before.

# CONTEXT

Terms this project uses in a particular way. A word lands here when a
conversation had to stop and define it — not before.

## Settings and layouts

**Layout record** — a saved `SavedLayout`: its monitors, its widgets, its
backgrounds. Lives in `LayoutsStore` (`root.layouts`) and is what reaches disk.
A record is edited whether or not anything is drawing it. The record side owns
the screens a layout stands on — monitors and remote screens alike — and the
lifecycle of the records themselves: creating, renaming, cloning, deleting.

**Live widget map** — the widgets the window is rendering right now, held by
`LiveWidgetsStore` (`root.liveWidgets`). It is a _projection_ of the active
layout record's own objects, not a copy, so an edit lands in the record itself
and there is nothing to commit. A layout with no monitors owns nothing, and the
map falls back to a detached set of shipped defaults. The map side owns the
projection and everything done to a widget in it: per-copy settings, geometry
and z-order, undo and redo, and what this window in particular is showing.

Read the record when you want what is saved (`root.layouts.activeLayout`); read
the map when you want what is on screen (`root.liveWidgets`). The two are
kept in step by the mutation log, not by living in the same class.

**Widget map** — the shape both widget-holding stores present: a set of widget
copies addressed by copy id, readable and mutable. It has two adapters. The
**live widget map** is the projection of the active record — what is on screen.
The **widget defaults catalogue** (`WidgetDefaultsStore`) is the template set a
new layout is seeded from — what is shipped. A caller holding either one reads
and edits widgets the same way; which one it holds decides whether the edit is
to what is racing or to what the next layout will start from.

**Editing session** — `LayoutEditorStore` (`root.layoutEditor`): whether the
layout editor is on screen. While it is, the layout under the cursor and the
layout on the overlay part company, so the driver's screen keeps auto-switching
underneath the one being edited. The session moves that pin; the pin itself is a
record-side pointer (`root.layouts.liveLayoutId`), because callers with no editor
read it too.

**Gesture** — a change to the layout records that also has to reach the live
widget map: creating or deleting a layout, dropping a screen, realigning the
screens to the hardware. Gestures are functions in `layout-gestures.ts` holding
both sides, never members of either store — that is what keeps the dependency
between records and map pointing one way.

**Mutation log** — `SettingsMutationLog`: what changed in the settings since
anyone last looked. Every settings write marks itself in it, and both marks are
why an edit reaches disk at all:

- a **token** moves — `changeToken` for a local edit, `syncToken` for one that
  arrived from the other window and must not be echoed back;
- the **widgets touched** are collected, so the overlay can be sent a patch of
  what moved instead of the whole layout. A write that installs a map wholesale
  says so instead, with `recordEveryWidget`.

The log holds ids, never widgets: only the store owning the live map can turn an
id into a record, and keeping that out is what lets a layout record mark itself
without knowing anything about widgets. See
[ADR-0002](docs/adr/0002-settings-writes-mark-themselves.md) and
[ADR-0003](docs/adr/0003-widget-state-lives-in-three-stores.md).

**Widget copy** — a second instance of one widget in the same layout, with its
own settings: one on the screen being raced on, another on a stream screen. Its
`id` addresses the copy, its `type` names the widget it is a copy of. `type`
absent means the record is the original and its `id` is its type — always read
it through `widgetTypeOf`.

**Remote screen** — a layout monitor with no display behind it, rendered by a
browser on the LAN. A monitor in every way that matters to a layout: widgets
belong to it by their centre point, it gets its own widget set, it is parked in
free desktop space, and no overlay window is opened for it.

## Widget preview

**Snapshot** — one frame captured from a live session and committed under
`test-data/`, the base every preview is seeded from. It supplies what is tedious
to invent and never interesting to vary: the driver list with its names, classes
and ratings, the track geometry, the session header. Singular and static — a
snapshot is a frame, never a stretch of time.

**Mock builder** — a pure function that returns one telemetry frame of the types
in `bindings.ts`, taking overrides and knowing nothing about any store. The
builders are the factory every preview draws from, and the reason there is one
set of fixtures rather than one for Storybook and another for the in-app
preview.

**Scenario** — a named state a widget can be in, assembled from builders on top
of the snapshot and applied to a preview store. A scenario exists for a state
the driver does **not** control and rarely sees: a flag, an open pit window, a
last lap, an overheat. A state reachable by a toggle in the widget's own
settings is not a scenario — the toggle already shows it.

A scenario belongs to the **domain of the widget that needs it**: the flag
widget declares flags, the fuel widget declares fuel. A widget with no states of
its own declares none and gets no picker; its preview still renders, against the
snapshot. The **layout editor** is the other consumer, and takes session-wide
scenarios that move the whole canvas at once.

**Preview store** — the isolated `RootStore({ skipInit: true })` a preview
renders against. It shares nothing with the stores the running widgets use;
settings are mirrored into it one way and nothing travels back. See
[ADR-0004](docs/adr/0004-widget-preview-runs-on-mocks.md).

# CONTEXT

Terms this project uses in a particular way. A word lands here when a
conversation had to stop and define it — not before.

## Settings and layouts

**Layout record** — a saved `SavedLayout`: its monitors, its widgets, its
backgrounds. Lives in `LayoutsStore` (`root.layouts`) and is what reaches disk.
A record is edited whether or not anything is drawing it.

**Live widget map** — the widgets the window is rendering right now, held by
`WidgetSettingsStore`. It is a _projection_ of the active layout record's own
objects, not a copy, so an edit lands in the record itself and there is nothing
to commit. A layout with no monitors owns nothing, and the map falls back to a
detached set of shipped defaults.

Read the record when you want what is saved (`root.layouts.activeLayout`); read
the map when you want what is on screen (`root.widgetSettings`). The two are
kept in step by the mutation log, not by living in the same class.

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
[ADR-0002](docs/adr/0002-settings-writes-mark-themselves.md).

**Widget copy** — a second instance of one widget in the same layout, with its
own settings: one on the screen being raced on, another on a stream screen. Its
`id` addresses the copy, its `type` names the widget it is a copy of. `type`
absent means the record is the original and its `id` is its type — always read
it through `widgetTypeOf`.

**Remote screen** — a layout monitor with no display behind it, rendered by a
browser on the LAN. A monitor in every way that matters to a layout: widgets
belong to it by their centre point, it gets its own widget set, it is parked in
free desktop space, and no overlay window is opened for it.

# ADR 0005: Each monitor owns its widgets

**Status:** accepted, 2026-10-03
**Context:** `settings.json` schema v6, `platform/sync/settings-file.ts`,
`LiveWidgetsStore`, `LayoutsStore`, the layout editor

## Decision

A widget belongs to **one monitor of its layout**, named in its `monitor`
field. Ownership is that field and nothing else — never the widget's position.

- A drag is clamped to the widget's own monitor. Only "move to monitor" hands
  a widget to another one.
- Every monitor has its own widget set and may hold several instances of one
  widget. No record is special for being the first in the layout: the record
  whose `id` equals its type is the first one a layout got, nothing more.
  Instances are numbered per monitor — the first of a widget on a monitor is
  the widget on that screen and is switched off, not deleted; a further one on
  the same monitor is a copy and can be deleted.
- A widget's hotkeys act on the instances **marked** for them (`hotkeys`): on
  by default on every screen, a browser screen included (it was first kept
  off one; a stream is meant to show what the driver switched to). A table on two
  displays is switched on one or both, as marked. Where one answer is needed —
  a widget store, a value the backend keeps once — the **primary instance**
  answers: a switched-on instance under the hotkeys. (A first cut named a
  primary monitor per layout instead; it could not say "this table, not that
  one" for two instances on two displays, and was dropped before release.)
- Removing a monitor removes its widgets.

On disk (schema v6) a widget is stored **under its monitor**, in that monitor's
own coordinates, holding only what is the user's:

- geometry in `frame`, the switch in `enabled`;
- in `settings`, **only the values that differ from the manifest**;
- a design size only when it is not the one the manifest (or the widget's own
  settings) gives — in practice, a widget whose orientation switch sets one;
- nothing else the manifest says: no label, description or flags.

In memory a layout keeps one flat `widgets[]` in desktop-wide coordinates, every
setting resolved. `platform/sync/settings-file.ts` is the codec between the two,
and the only module that knows the file's shape.

## Why

The driver's model was "this widget is on that screen", and the code's was "this
widget is wherever its centre happens to be". The gap showed up in the editor:
a widget never switched on sat at its shipped coordinates, which are on the
first monitor, so a freshly added monitor had nothing to switch on, and the only
way to get a widget onto it was to enable it on the first monitor and drag it
across — or duplicate it and drag the duplicate. A monitor owning its own set is
what lets each screen list every widget with its own switch.

Storing the owner rather than deriving it also removed code that existed only
to keep the derivation true: resolving owners against a monitor's _old_ bounds
before moving it, parking unplugged monitors so their widgets would not be
captured by a neighbour, rehoming a removed monitor's widgets.

Writing only the overrides removes `mergeWithDefaults` over every layout copy
(`restoreWidgets`, `restoreLayoutWidgets`), and with it the standing problem
that a manifest change to a default or a design size never reached an existing
install — a stored copy of the old value always won.

## Considered and rejected

- **Keep the flat stored list and derive ownership from the position**, adding
  only per-monitor switches in the editor. Cheaper, but it kept the four things
  the change was for: the centre-point test, desktop-wide stored coordinates,
  manifest data written into every record, and the original/copy split.
- **A stable uuid per monitor** as the owner key. Monitor names are already
  unique within a layout and never renamed, and every window addresses its
  monitor by name; a second key would have had to be kept in step with it.
- **Deriving every design size from settings** so none is ever stored. An
  orientation switch (the engine panel, the relative map) sets a design height
  that no setting computes today; making every such widget derive both axes is a
  separate piece of work. Until then a design size is stored only where it
  differs.
- **Dropping the "every widget has a record in every layout" rule.** Kept, for
  now: `setWidgets` adds a switched-off instance of every widget a layout lacks,
  on the first display, so the editor always has one to switch on. The
  per-monitor editor panel is what makes this rule unnecessary.

## Consequences

- A changed manifest default reaches every widget that never overrode it. That
  is the point, and it is also a behaviour change to keep in mind when changing
  one: users who left a value alone see the new one.
- A migration after v6 walks the file with the `*Stored*` helpers in
  `settings-schema/blob.ts`; the older helpers find nothing in a current file.
  A patch sees only overrides — an absent key is on the shipped default.
- Migration v6 carries settings over **whole**: deciding which ones equal the
  default would mean reading this build's defaults, which a migration must
  never do. The first save thins them.
- A widget store reads `settingsOfType(type)`. Reading `getSettings(type)` finds
  the record whose id is the type, which may be switched off on another monitor
  or deleted.

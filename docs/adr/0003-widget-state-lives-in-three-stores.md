# ADR 0003: Widget-related state lives in three stores, split on one seam

**Status:** accepted, 2026-09-10
**Context:** the layout and widget settings stores (`store/settings/`)

## Decision

The seam is the one `CONTEXT.md` already names: a **layout record** is what is
saved, a **live widget map** is what this window renders. Everything falls to
the side it belongs on, and the editing session becomes a third, small module
because it exists only while the editor is open.

The three are built in dependency order and the order is one-way: the records
know nothing, the map projects the records, the session drives both. No store
holds a deferred reference to another.

- `LayoutsStore` (`root.layouts`) — the records and the screens they stand on:
  record lifecycle, every remote-screen operation, the hardware-facing members,
  and the two pointers into the record set — which layout is being edited and
  which one the overlay renders.
- `LiveWidgetsStore` (`root.liveWidgets`) — the projection of the active record:
  per-copy mutation and geometry, z-order, undo/redo, the projection selectors,
  this window's own configuration, cross-window sync and its late-echo guard.
- `LayoutEditorStore` (`root.layoutEditor`) — the editing session: whether the
  editor is open, the derived preview mode, and the gestures that move the
  pin — opening, closing, switching, activating, and applying the layout the
  session asks for.

The **pin** lives with the records rather than with the session that moves it.
It is the same kind of value as `editingLayoutId` — a pointer into the record
set — and it is read by callers that have no editor at all: persistence, remote
publishing, the overlay window watcher. The session owns `open`, and `open` is
the whole of its state.

A change to the records that also has to reach the live map is a **gesture**,
and gestures are functions in `layout-gestures.ts` holding both sides:
`createLayout`, `deleteLayout`, `removeMonitor`, `alignMonitorsToHardware`. A
store that reached across would make the dependency point both ways, and then
neither store can be built, read or tested without the other. Only a rebuilt
widget _list_ needs one — a screen that merely moves writes to the record's own
widget objects, which the map projects rather than copies.

First-run setup is a function for the same reason (`setUpFirstRun`): it
coordinates all three exactly once per installation, and taking a hardware
resolver as a parameter is what makes its asynchronous path testable. `WidgetDefaultsStore` is unchanged in composition but has a declared
role — the second adapter over the **widget map** contract.

## The problem

One 1565-line store with 77 public members, reached from ~300 call sites, was
edited for five unrelated reasons: screen topology, the projection of the active
layout, per-widget mutation, starter templates, cross-window sync. Two people
working on unrelated features collided in it, and every change carried the risk
of the other four zones. The glossary and the code disagreed — a remote screen
was defined as a monitor, but monitors lived in `LayoutsStore` while remote
screens lived in the big store — and there were two paths to the records and two
to the mutation counters. `saveLayout` did not save a layout; it created one.

Size was not the problem and was rejected as a cutting criterion early: cutting
for line count produces small modules with the same total interface and the same
coupling. Size was the symptom of the five reasons to change.

## Why not a compatibility façade

Keeping the old member names as delegations would have made the split invisible
at the call sites, and that is exactly what makes it worth refusing. It is the
Middle Man that ADR-0002 was already removing — ten of the old store's members
were one-line delegations onto `LayoutsStore`, and a third of the call sites had
already gone around them. More importantly it preserves the 77-member interface,
which is the thing this work exists to reduce. The interface narrows at the
consumer or not at all: a component that needs widget geometry should stop being
offered layout CRUD, and it only stops if the call site moves.

## Why not a split by window role

Main versus overlay looks like a natural line, because the two windows do use
the store differently. It was rejected: the window is a runtime role configured
at construction — this window's screen name and its logical resolution — not a
domain boundary. Splitting on it duplicates near-identical logic across two
stores and leaves the five reasons to change intact inside each of them.

A flat set of five or six peer stores, one per reason, was rejected for the
related reason: with no ownership seam under them, each peer has to know the
other five, so total interface width does not fall.

## What this costs

Roughly 50 members remain on `LiveWidgetsStore`, against 37 on `LayoutsStore`
and 6 on `LayoutEditorStore`. That is accepted rather than cut further — they
share one reason to change. Collapsing families of
members into parameterised ones was considered and rejected: the caller still
has to know every mode, the modes move from the type system into a discriminant,
and the compiler stops catching mistakes at the call site.

`LiveWidgetsStore` takes four named constructor dependencies instead of the
root store, and holds no reference to the editing session at all. This deliberately does not follow the `Pick<RootStore, …>` pattern
that landed immediately before it: that slice is the remedy for a store
consuming an arbitrary part of the global tree, and named classes from one
subsystem are already narrower than a slice of the root.

The fourth is not a store but a getter, `() => CapabilitiesPayload | null`. What
the sim can feed is the one thing this store reads from outside its own
subsystem, `SimStore` is built after it, and the answer changes with every
connection — so it is read on demand rather than held. A getter also keeps the
dependency at one value instead of handing the store a sim it could ask anything
else.

## What is pinned

Three orderings are correctness-critical and are covered by tests rather than by
comments: deleting the active layout loads the fallback's widgets _before_ the
mutation token moves; layout creation and first-run both re-check that the
layout they are filling is still the one being edited after their asynchronous
monitor lookup; and the late-echo guard carries the synced layout id so an echo
crossing a layout switch cannot land in the wrong record.

A fourth is not an ordering but a shape: the layout editor's mode effect
registers its cleanup only on the branch that opened the session. React tears
the previous effect down before running the new one, so a cleanup that closed
unconditionally would close the session the click handler had just opened, and
hand the editor the layout that was live instead of the one that was clicked.
`setOpen` being idempotent is what the shape relies on, and that is the part a
test pins.

The widget map contract is pinned by the typechecker: both adapters declare they
satisfy it, so a member removed from one fails the build instead of a call site.

## When to reopen this

If a third adapter over the widget map appears — the preview stores are the
likely one — check that the contract still describes all three before widening
it. And if a change turns out to need two of the three stores at once, that is
the signal to re-read the seam, not to merge them: `ensureDefaultLayout` is the
one place where coordinating all three was the right answer, and it is a
function precisely so no store had to learn about the others.

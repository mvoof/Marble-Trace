# ADR 0002: A settings write marks itself, in a log both stores share

**Status:** accepted, 2026-09-07
**Context:** the layout façade inside `LiveWidgetsStore`

## Decision

`SettingsMutationLog` (`store/settings/mutation-log.ts`) holds `changeToken`,
`syncToken` and the set of widgets touched. `LayoutsStore` and
`LiveWidgetsStore` are both constructed with it and both write into it, so a
layout record marks its own writes instead of being wrapped in a façade method
that remembers to.

The log is **not** reached through a reaction on the records. That alternative
is the one to re-read this record before proposing again.

## The problem

Two marks have to be left on every settings write besides the write itself: a
token has to move — the save and emit reactions watch it — and the widgets that
changed have to be collected, so the overlay gets a patch instead of the whole
layout. Both were spelled out by hand at 36 call sites, all inside one 1505-line
class, and a write that forgot them failed in the worst possible way: the edit
appeared on screen and was never saved.

That forced every layout write through a façade method on
`LiveWidgetsStore`, because `bumpMutation` was private to it — which is why
ten of its members were one-line delegations onto `LayoutsStore`, and why a
third of the call sites had already gone around them to `root.layouts`.

## Why not a reaction on the records

The obvious cheaper move is to leave the mark where it is and have
`LiveWidgetsStore` react to a token on `LayoutsStore`. It was rejected: it
turns "the record changed, now re-project the live widgets" from a call into a
scheduled effect, and the ordering is load-bearing at exactly the moment it is
hardest to see. A layout switch already carries an echo in flight from the
overlay — `syncedLayoutId` exists so an echo crossing a switch does not land in
the wrong record — and adding a second asynchronous step to that sequence buys
nothing that the shared log does not already give.

## What this costs

Both stores now take a constructor dependency, so `RootStore` builds the log,
the records and the widget store in that order. In exchange `LayoutsStore` is
constructible in two lines, which is what its first tests
(`layouts.store.test.ts`) are written against.

A second, smaller consequence: a write that finds nothing to change — no such
layout, no such monitor — no longer marks anything, where the façade marked
unconditionally. That is pinned by two cases in that file rather than left as a
claim.

## What is pinned

`live-widgets.store.test.ts` tables every write of the live widget map and
the mark it leaves; `layouts.store.test.ts` does the same for the records. A
write added without a mark fails there, which is the whole point of moving the
rule.

## When to reopen this

If a third writer of settings appears that is neither a layout record nor the
live widget map, check whether the log's vocabulary — one widget, every widget,
synced — still describes what it does, rather than adding a fourth `record*`
method to make it fit.

## Since

The seam this record stopped at was drawn afterwards. The class described above
as `LiveWidgetsStore` was then a single 1505-line store still named
`WidgetSettingsStore`; its screens, record lifecycle and editing session have
since moved out to their owners. See
[ADR-0003](0003-widget-state-lives-in-three-stores.md). The text above is left
as it was written, describing the state it was decided against.

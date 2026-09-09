# ADR 0001: Telemetry frames stay whole observables

**Status:** accepted, 2026-09-06
**Context:** the rendering rule (`docs/rendering.md`)

## Decision

Telemetry frames keep being stored as whole `observable.ref` values. Per-field
observables are **not** pursued, and no delta on the wire is implied by this
work. The question is closed until a measurement reopens it.

## The question

A component reading one field of a frame wakes on every change to that frame,
including fields it never reads. That is a different defect from a component
that wakes because its own field genuinely changed, and the two need different
fixes. Only the first is an argument for splitting frames into per-field
observables.

## How the two were separated

Wake-ups alone cannot tell them apart, so the separator is what the burst puts
on screen. Every widget whose manifest declares a hot field was mounted, a
one-second synthetic burst of telemetry was replayed through it, and the
widget's markup was hashed after every frame. A widget whose markup took one
value across a burst that woke it hundreds of times rendered nothing it was
woken for.

## The numbers

Wake-ups are the totals measured per widget during that burst; distinct
renderings are out of 60 frames.

| widget            | wake-ups | distinct renderings |
| ----------------- | -------- | ------------------- |
| `standings`       | 1565     | 1                   |
| `race-dash`       | 360      | 60                  |
| `input-trace`     | 300      | 32                  |
| `relative`        | 242      | 1                   |
| `invisible-dash`  | 224      | 60                  |
| `track-map`       | 184      | 60                  |
| `radar-bar`       | 120      | 1                   |
| `pit-service`     | 120      | 1                   |
| `engine-panel`    | 120      | 1                   |
| `sector-matrix`   | 120      | 35                  |
| `relative-map`    | 119      | 1                   |
| `rpm-lights`      | 61       | 15                  |
| `proximity-radar` | 60       | 1                   |
| `timer`           | 60       | 1                   |
| `weather`         | 60       | 60                  |
| `coach`           | 60       | 29                  |
| `close-battle`    | 0        | 1                   |
| `g-meter`         | 0        | — (all canvas)      |

Of 3655 wake-ups, 2406 — two thirds — produced a single rendering.

## Why that is not the case for per-field observables

Reading the two-thirds as "wakes on a field it does not read" is the wrong
reading. Every widget in the one-rendering group falls into one of three causes,
and per-field observables address none of them.

**A canvas, not the DOM.** `proximity-radar` and `radar-bar` draw inside a
canvas, so their output is not in the markup and the hash cannot see it. Their
"1" says nothing about whether the wake-up was wasted. `close-battle` is in the
group with zero wake-ups at all, which is the rule already applied.

**Formatting resolution, not the wrong field.** `standings`, `relative`,
`relative-map` and `timer` read exactly the field the burst moves — a lap
distance, an estimated time — and draw a gap rounded to two decimals. The burst
advances a lap per minute, so the number under the formatting really does
change, and the string it renders does not. The component was woken by its own
field. Splitting the frame per field changes nothing here.

**The burst is faster than the wire.** `driverEntries`, `relative` and
`proximity` are on the **10 Hz** tier, not the 60 Hz one, and the burst advances
every hot field a widget declares sixty times a second regardless of its tier.
For those three the measurement overstates the real rate by six times.

On top of that, the burst writes into the store directly and so bypasses both
mechanisms that already remove this traffic in production: `telemetry/quantize.rs`
rounds the per-car frames to the precision a widget draws, and
`telemetry/publications.rs` then drops any frame identical to the last one
published. The frames that produce one rendering here are largely frames that
never leave the backend at all. The numbers above are an upper bound on a cost
that is already partly paid down on the wire.

## What the alternative would cost

Per-field observables over the per-car frames means an observable per field per
car — sixty-three cars against a `relative` frame of a dozen fields is on the
order of eight hundred observables replacing one reference, rebuilt whenever the
field list changes. MobX's own overhead per observable is not free, and the
frames are replaced wholesale by the backend rather than mutated in place, so
the split would have to be re-derived on arrival: the reconciliation would run
sixty times a second to save renders that quantization already prevents.

Weighed against a saving whose real size is unknown — because the measurement
that produced 2406 bypasses the wire's own suppression — that is not a trade
worth making now.

## What to do instead

The one-rendering group is a **rendering** problem where it is one at all, and
`docs/rendering.md`'s rule already names it: a component that reads a hot field
returns as little as possible, and a single value at 60 Hz goes through the
sanctioned bypass.

## When to reopen this

If a widget appears whose markup is genuinely driven by one field of a frame
whose _other_ fields change at 60 Hz — many wake-ups against few distinct
renderings, and none of the three causes above explain it — measure it against
the wire rather than against a synthetic burst, and reopen this record with
that number.

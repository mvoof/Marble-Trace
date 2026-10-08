# Architecture decisions

One file per decision that was argued and could have gone the other way. A
decision that a later one overturns keeps its file and says so in its status
line; it is never edited into agreeing with the new one.

| ADR                                                | Decision                                                                                                | Status                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------- |
| [0001](0001-per-field-telemetry-observables.md)    | Telemetry frames stay whole observables rather than one observable per field                            | accepted, 2026-09-06      |
| [0002](0002-settings-writes-mark-themselves.md)    | A settings write marks itself in a log both stores share                                                | partly superseded by 0007 |
| [0003](0003-widget-state-lives-in-three-stores.md) | Widget-related state lives in three stores: layout records, the live map, the edit session              | accepted, 2026-09-10      |
| [0004](0004-widget-preview-runs-on-mocks.md)       | The widget preview runs on mock builders, not on recorded sessions                                      | accepted, 2026-09-14      |
| [0005](0005-monitors-own-their-widgets.md)         | Each monitor owns its widgets                                                                           | accepted, 2026-10-03      |
| [0006](0006-telemetry-stays-json.md)               | Telemetry stays JSON — the binary transport failed its measured gate                                    | accepted, 2026-10-05      |
| [0007](0007-main-owns-settings.md)                 | Main owns the settings; every other window is a client of one protocol                                  | accepted, 2026-10-05      |
| [0008](0008-frontend-by-feature-sliced-design.md)  | The frontend is laid out by Feature-Sliced Design; a widget's settings are described once, in its slice | accepted, 2026-10-08      |

When a decision is resolved, see [`docs/agents/domain.md`](../agents/domain.md)
for how the record is written.

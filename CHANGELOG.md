# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Wheel and Button Box Bindings:** Every action that could be bound to a key can now be bound to a button on your wheel, button box, joystick or handbrake instead — read straight from the device, so it still works while iRacing has focus. Unplugging a device or moving it to another USB port keeps its bindings, and a device that is currently unplugged keeps its bindings too, shown greyed out until it comes back.
- **One Bindings Screen:** All keys and buttons now live in a single **Input bindings** section in Settings, grouped by widget, with a search box and a warning next to any binding used by more than one action. You can assign several keys or buttons to the same action.
- **Show and Hide Any Widget by Key:** Every widget can now be added to or removed from the current layout with a binding of its own.

### Changed

- **Bindings No Longer Belong to a Layout:** Keys used to be stored per layout, so switching layouts silently changed them and the same key had to be entered again in every layout. They are now app-wide — set once, and they work everywhere. Because of that, widget keys you had set before are not carried over: the same key meant different things in different layouts, and there is no honest way to pick a winner. Drag, interact and hide-all keep working on F9, F8 and F10; anything else takes a moment to set again on the new **Input bindings** screen, where you can now give one action several keys and wheel buttons at once.
- A binding for a widget that isn't in the current layout now does nothing instead of firing invisibly in the background.
- **Your Settings File Is No Longer Thrown Away:** If Marble Trace can't read your settings — because they were saved by a newer version, or the file got damaged — it now leaves the file exactly as it is and tells you what happened, instead of quietly deleting it and starting from scratch. A copy of your old settings is also kept alongside them whenever an update converts them to a new format.

### Fixed

- **Keys Missing After Updating:** Actions you had never customised could end up with no key at all after an update, because your settings file only listed the keys you had changed by hand. Only your own changes are stored now, and everything else follows whatever the current version ships — so new actions arrive with their keys already working, and a key you deliberately cleared stays cleared.

## [0.20.0] — 2026-07-29

### Added

- **Live Track Positions:** The standings and relative widgets can now order drivers by where they actually are on track right now, instead of waiting for the sim to update the official order at the start/finish line. Cars in the pits, the garage or being towed keep their official position, so a car sitting in its box no longer creeps up the table.
- **Live / Official Positions Toggle:** Every widget that shows a position number — standings, relative, race dash and timer — now has its own switch between the live track order and the official order from the sim, so you can use live order in the table and official order on your dash if you prefer.
- **Overtake Arrows:** When someone gains or loses places, a large arrow appears next to their row and the row slides to its new spot with a smooth animation, so you can see the move happen rather than just noticing a different number.
- **Drivers Ahead and Behind You:** A new standings setting lets you show a chosen number of drivers directly ahead of and behind you, instead of only the top of the field, so your own battle is always on screen.
- **Rows Per Class in Grouped View:** In the grouped multi-class view you can now limit how many drivers are shown for each class, keeping the widget compact in big fields.
- **Your Own Class First:** In multi-class races your class is now listed first in both the grouped and the class-cycling views, so you never have to look past other classes to find yourself.
- **Scrollable Standings Table:** The standings table can now be scrolled through the whole field instead of showing a fixed slice, and it returns to its normal view by itself after a few seconds of no input.
- **Interact Mode:** A new mode lets your mouse reach the overlay — scrolling the standings, pressing buttons — without unlocking widget dragging. It is bound to **F8** by default, works either as a toggle or hold-to-use, and switches itself off after 15 seconds so the mouse goes back to the game. (Widget editing stays on **F9**.)
- **Standings Hotkeys:** You can assign your own keys for switching the view mode, stepping to the previous or next class, and scrolling the table up and down, so the standings can be operated from the wheel without touching the mouse.
- **Multi-Monitor Overlay:** The overlay now covers all of your screens at once instead of living on a single chosen monitor. Each layout remembers which screens it uses, and you can add or remove screens from the layout toolbar.
- **Drag Widgets Between Monitors:** Widgets can be dragged straight across a screen edge onto the neighbouring monitor, and the layout editor can either show all your screens at once for moving things around or zoom into a single screen for detail work. Each monitor can have its own background image, and everything follows along if you rearrange your displays in Windows. Existing layouts are carried over automatically.
- **Session Clock in the Standings Header:** The standings header can now show the remaining session time, with a toggle to hide it.
- **Car Class Badges from the Sim:** Class badges now come from the sim itself instead of being guessed from the car name, so every car in a class carries the same badge (`GT3`) rather than a different one per manufacturer. AI and hosted races, where the sim leaves the class name empty, are handled too.
- **Track Map — Zoom on Your Car:** A new zoomed view keeps your car centered on the track map so nearby traffic is easier to read.
- **Track Map — Heading-Up Rotation:** An optional mode rotates the zoomed map with you, so the direction you are driving is always up.
- **Fuel — Next Pit Stop Forecast:** The fuel widget now tells you which lap you are due to pit on before the pit window even opens.
- **Fuel — Consumption Columns:** Optional extra columns show your fuel consumption figures, and the widget rearranges its grid to fit whichever ones you turn on.
- **Race Dash — Steering Marker:** An optional dot orbits the gear ring exactly like a marker taped to your real wheel — 90 degrees of steering is 90 degrees of orbit — with a trail showing how far you have wound the wheel.
- **Steering Lock in App Settings:** Your wheel's steering lock is now set once on the general settings page instead of separately per widget, and is applied everywhere it is needed. Your existing value is carried over.
- **Race Dash — RPM Comb:** The gear ring can now show a comb-style RPM scale around it.
- **Race Dash — Shift Zones on the Ring:** The ring is now printed in three zones — normal, shift and blink — so the moment the color changes matches a marked edge instead of happening at an invisible point.
- **Pace Car:** The pace car is now recognised and marked with its own indicator in the flags, track map and relative widgets, and there is a setting for whether it should still be shown while it sits in the pits.

### Fixed

- **Blue Flag at the Start:** Fixed the blue flag from the pace lap staying lit alongside the green flag when the race starts. Green now takes priority.
- **iRating Estimate Before the Start:** Fixed the ± iRating column showing a gain nobody had made while the field was still loading onto the grid — it now stays empty until the green flag, and is based on your position within your own class.
- **Track Map Empty on Startup:** Fixed the track map showing a stuck recording overlay instead of the shape it had already saved for that track.
- **Layout Editor Preview:** Previewing a layout in the editor no longer changes what is actually shown on the overlay.
- **Wrong "Layout Switched" Notification:** Fixed the layout-switch message appearing when simply closing the layout editor, even though nothing had switched.
- **Widget Defaults on the Preview Page:** Fixed settings changed on the widget preview page not being saved.
- **Cut-Off Button Labels:** Fixed some buttons showing truncated text in other languages.
- **Relative and Standings Disagreeing:** Fixed the relative widget showing a different position number than the standings table for the same driver.
- **Overlay Stability:** Fixed several internal issues that could cause glitches over long sessions, including leftover background work left behind by every widget preview, and the input trace graph drifting out of sync with its bars.

## [0.19.0] — 2026-07-18

### Added

- **RaceDash Widget:** A brand new dashboard widget replacing the old Speed widget, combining your speed, position, lap, pit status, RPM, and a driving coach into one polished display. The coach compares your driving to a saved reference lap and gives you real-time brake and throttle guidance, including an early "get ready to brake" warning before each braking zone.
- **RPM Lights Widget:** The RPM lights, previously part of the Speed widget, are now their own standalone widget, and light up and blink the entire LED bar when you hit your shift point.
- **Auto-Switch Layouts:** Widget layouts can now automatically switch based on what you're doing in the sim — practice, qualifying, race, or sitting in the garage — with an on-screen notification when a switch happens.
- **Independent Text Size:** A new setting lets you scale widget text size on its own, separate from the widget's overall size, so shrinking a widget no longer forces smaller text.
- **Multi-Language Support:** The main app window is now available in English, Russian, and Chinese, with an option to follow your system language automatically.
- **Launch Minimized:** You can now set the app to start minimized instead of opening its window every time.
- **Radar Distance Labels Toggle:** Added a setting to hide distance labels in the radar bar and proximity radar for a cleaner look.
- **Activity Log File:** The app now keeps a log file on disk with startup and settings details, making it much easier to diagnose problems.

### Changed

- **Widget Selection & Resizing Polish:** Selecting and resizing widgets feels smoother now, with a visible highlight on resize handles and a selection outline that always stays on top.
- **Smarter Settings Recovery:** If your saved settings are missing pieces or slightly out of date, the app now fills in the gaps intelligently instead of resetting things it doesn't need to.

### Fixed

- **Reconnect Spam:** Fixed the app repeatedly trying to reconnect while sitting in the online lobby.
- **Input Trace Glitches:** Fixed the input trace graph clipping at the very top and bottom, and fixed data getting dropped when toggling channels on and off.
- **Widget Snapping Accuracy:** Fixed widgets snapping to the wrong position on some widgets and monitor setups.
- **Status Flicker:** Fixed the status indicator flickering and showing the wrong waiting state between sessions.

## [0.18.0] — 2026-07-01

### Added

- **Layouts:** You can now save, load, rename, and delete complete widget setups as named layouts, so you can quickly switch between different arrangements for different needs.
- **Layout Editor:** A brand new visual editor lets you arrange, resize, and preview your widgets directly on the overlay, making it much easier to build the exact setup you want.
- **Widget Preview:** While editing a layout, widgets now show a live preview of how they'll actually look, so you can fine-tune everything before saving.
- **Engine Panel Widget:** A new widget showing key engine information at a glance.

### Changed

- **Speed Widget Overhaul:** The speed widget has been redesigned. It now shows clear pit stop status, along with your current race position and lap number, right alongside your speed.
- **Visual Polish Everywhere:** Lots of small visual improvements across the app — refreshed weather icons and temperature display, better contrast on safety rating badges, cleaner widget backgrounds, a redesigned DQ flag and DNF badge, and general spacing and badge touch-ups in the standings and relative widgets.

### Fixed

- **Track Map Recording:** Fixed the track map sometimes re-recording a track that was already saved, and made sure recording resets correctly across windows, with buttons disabled when no track is loaded.
- **Delta Widget Flicker:** Fixed the delta widget briefly disappearing due to momentary data glitches.
- **Title Bar Dragging:** Fixed spots along the window title bar where dragging the window didn't work.

## [0.17.0] — 2026-06-19

### Added

- **Drag Toolbar (Overlay):** In edit mode, a floating toolbar now appears near each widget — snap it to common positions or open its settings panel directly from the overlay without switching to the main window.

### Changed

- **LED Flags — Flag Matrix Animations:** The LED flags widget now features a fully animated flag matrix with two display variants — split and single.
- **Standings & Relative — Visual Polish:** Class color is now shown next to the position number, columns have been reordered for better readability, and the player's row now has a subtle gradient highlight.
- **Fuel Widget — Redesign:** The fuel widget has been rebuilt from scratch with a stats row, a laps bracket section, and the unit label moved into the header for a cleaner layout.
- **Timer Widget — Session Header Colors:** The session type header is now color-coded to help you instantly identify the current session. End-of-session detection has also been fixed on checkered flag.
- **Qualifying Start Positions:** Start positions for qualifying sessions now prefer the actual qualifying result over live race position, giving more accurate grid order in the standings.
- **Track Settings Storage:** Track rotation preferences are now stored in a dedicated `track-settings.json` file, separating them from the main settings and making the data structure cleaner.

### Fixed

- **LED Flags — Auto-Hide:** Removed CSS overrides that were preventing the LED flags widget from hiding correctly when auto-hide was active.
- **Standings — Zero Position Fallback:** Fixed a case where drivers could show position 0; the widget now correctly falls back to their start position.
- **Track Map — Shape After Hide:** Fixed an issue where the track map shape would disappear after toggling the "hide all widgets" option and re-enabling it.

## [0.16.0] — 2026-06-07

### Added

- **Overlay Monitor Selection:** You can now choose which monitor displays the overlay in the app settings — essential for multi-monitor setups.
- **Separate License and iRating Columns (Standings & Relative):** The license badge and iRating are now displayed in separate columns, making the tables easier to read at a glance.
- **Reset Settings Button:** Added a button to reset all widget settings back to their defaults in case something goes wrong or you want a fresh start.

### Changed

- **Simplified Widget Background Settings:** Background color is now a single setting instead of two — less clutter, same result.
- **PRED Always Uses Personal Best:** The predicted lap time (PRED) in the Sector Matrix widget now always compares against your personal best — no extra configuration needed.
- **Smart Table Width Adjustment (Standings & Relative):** When you toggle columns on or off, the widget automatically resizes to fit the visible content — font size and row height stay the same.
- **Updated app background animation.**

### Fixed

- **Accurate Lap Tracking:** Fixed an issue where the Delta widget and lap log could lag one lap behind and show duplicate times at the start of a session.
- **Fuel Reset on Disconnect:** Fuel calculations and predictions now correctly reset when iRacing disconnects, preventing stale data from appearing at the start of a new session.
- **Delta Widget Alignment:** Fixed text offset for delta time and lap time display.

## [0.15.0] — 2026-05-31

### Added

- **ABS Active Indicator (Input Trace Widget):** The brake bar and the brake trace line in the graph now dynamically change to a customizable ABS active color when ABS is triggered, helping you visually monitor and analyze wheel lockups in real-time.
- **Steering Wheel (Input Trace Widget):** Added display of steering wheel position, as well as a line on the graph.
- **Interactive Track Rotation (Track Map Widget):** Rotate the track map by 90-degree increments in edit mode, with orientation preferences saved per track.
- **Multi-Class View Mode (Standings Widget):** Group drivers by their vehicle class rather than overall position in multi-class races, complete with beautiful class headers.
- **Pit Lane State Tracking (Standings & Relative):** Real-time tracking and styling for `PIT IN` and `PIT EXIT` states for each driver in the standings and relative tables.
- **Track Wetness & Weather Tracking:** Real-time track wetness tracking, adding humidity, wind, and wetness details to the standings footer and weather widgets, including dynamic temperature-based color indicators.

### Changed

- **Player and Leader Markers (Track Map Widget):** Replaced basic text tags with custom inline SVGs for the player (featuring a dynamic glow effect) and class leaders (featuring a matching class-colored crown).
- **Modernized Badge Designs:** Redesigned safety license displays into clean two-part pill badges and streamlined iRating displays by removing borders and backgrounds.
- **Redesigned Standings Header & Footer:** Moved player pitstops and weather temperatures to a new dark-themed footer, freeing up header space for new stats like Strength of Field (SOF), Drivers, Incidents (INC), and Pit counters with dynamic, warning-colored icons.
- **Adaptive Car Numbers:** Car number text inside dot markers automatically flips its color to maximize contrast and readability against the background.
- **Streamlined Graph Settings (Input Trace Widget):** Replaced the old layout options with per-channel toggles (`showTrace` and `showSteering`), allowing the graph area to naturally resize and reclaim empty screen space when disabled.
- **Polished Timer & G-Meter Widgets:** Right-aligned simulator dates in the Timer widget, added subtle divider lines, and resized the G-Meter labels slightly to prevent text clipping at the borders.

### Fixed

- **Perfect Track Recorder Loops:** The track recorder now automatically trims overlapping points and applies drift correction when a lap is completed, resolving squiggly or distorted start/finish lines.
- **Robust Pit Lane Detection (Track Map Widget):** Fixed an issue where driving parallel to the start/finish line in the pits would accidentally trigger a new recording or lap, by combining vehicle telemetry with track surface status.
- **Text Clipping (Delta Widget):** Optimized line-height and centering to prevent vertical and horizontal text clipping in the Delta HUD.
- **Wasted Column Space (Relative Widget):** Flags and pit badges are now embedded directly in the driver name cell, saving precious screen width.
- **Smooth Track Map Rendering:** Moved track data to reference objects to avoid unnecessary re-renders, preventing micro-stutters and stale state calculations.
- **Accurate Lap Deficits (Standings Widget):** Lapped driver gaps (e.g. +1 L, +2 L) are now computed using high-precision continuous track coordinates.
- **Graceful Weather Fallbacks:** The weather widget now handles missing telemetry robustly, showing clear placeholders (`--`) instead of falling back to incorrect default values like "DRY".

## [0.14.0] — 2026-05-28

### Added

- **Accurate Radar Proximity:** The selected car length setting is now synchronized and used directly in distance calculations for highly accurate proximity alerts.

### Changed

- **Clean Borderless Fullscreen:** Rebuilt the screen overlay so it perfectly matches your monitor size. This permanently resolves the Windows bug where thin colored borders appeared around the transparent screen when clicking outside the app.
- **Class-Specific Positions:** In the Relative widget, driver positions are now shown within their own vehicle class rather than the overall race standings. This makes it much easier to track direct competitors in multi-class sessions.
- **Official Class Colors:** Mapped all vehicle class telemetry colors to match the official iRacing class colors.
- **Simplified Radar Settings:** Removed redundant and confusing options. The radar bar widget now automatically shows the active side only when active.
- **Improved Radar Positioning:** Both side bars remain visible in Edit Mode (F9), making them easy to position on your screen.
- **Cleaned Up Relative UI:** Removed the trend (pace change) icon to reduce visual clutter and improve app performance.
- **Polished Layouts & Text Spacing:**
  - Expanded the default width of Standings and Relative widgets to prevent long driver names and car labels from wrapping onto multiple lines.
  - Reduced column spacing in Standings to make the data more compact and readable.
  - Aligned class badge and safety rating badge heights for a consistent look.
  - Reduced the default width of the Delta widget to 150px for a cleaner, less distracting HUD.

### Fixed

- **Phantom Radar Alerts:** Fixed an issue where the radar would occasionally show red proximity indicators when no car was nearby.
- **Lap Timer Updates:** Fixed an issue where the app could miss lap time updates when recovering from negative telemetry values.

## [0.13.0] — 2026-05-27

### Added

- **Delta HUD Widget (`DeltaWidget`):** Brand new widget replacing the old "Lap Delta". Shows live delta time to a reference lap (best, optimal, etc.) with custom color coding and a full screen flash on lap completion.
- **Sector Matrix Widget (`SectorMatrixWidget`):** Brand new widget replacing the old "Lap Times". Provides a comprehensive sector grid showing current, best, and session sector times, color-coded based on personal improvement (green) or session best (purple). Features a progress bar for the current sector and overall lap.
- **Lap Log Widget (`LapLogWidget`):** Brand new widget showing a history log of recent laps, flags, and delta times.
- **RootStore & React Context Architecture:** Replaced singleton store exports with a centralized `RootStore` architecture provided through React Context, improving testability, Storybook isolation, and resource management (adds proper cleanups/disposes to prevent memory leaks).
- **Centralized Design System:** Introduced dedicated design tokens (`_sys-tokens.scss`, `_widget-tokens.scss`, `_opacity.scss`) for colors, opacity, and layout spacing to ensure UI consistency.
- **Auto-Hide System (`widgetAutoHideStore`):** Added a global auto-hide manager and `useWidgetAutoHide` hook to handle smooth, delayed widget hiding across multiple widgets (e.g. Radars, Flags).

### Changed

- **MobX Reactivity Overhaul:** Full transition to the observer pattern. Cleaned up widget rendering by moving store subscriptions from root components down to individual leaf/sub-components (preventing unnecessary 60Hz re-renders).
- **Weather Widget Redesign:** Extracted into `ForecastBlock`, `StatsGrid`, and `WindCompass` (with observer subcomponents `RotatingRing` and `WindArrow`). Wind unit scales correctly, and the layout is redesigned to a 2x2 grid.
- **G-Meter Optimization:** Decomposed into static rings (`GMeterRings`) and high-frequency trace (`GMeterTrace`) canvas layers for exceptional performance and CPU/GPU overhead reduction.
- **Input Trace Redesign:** Removed horizontal bar mode, decomposed into independent observer components, and moved smoothing and circular buffer logic out of the root container.
- **Chassis Widget Cleanup:** Decomposed tire and suspension stats into subcomponents (`TireWearCell`, `TireTempCell`, etc.) and moved telemetry reads to individual leaf nodes.
- **Rating Badge Update:** The `RatingBadge` component now displays the license letter alongside the safety rating (e.g., A 4.99).

### Fixed

- **Diode Colors & Timer Reset:** Fixed LedFlag diode colors and auto-hide timer resets.
- **Layout & Clipping Fixes:** Fixed canvas/compass clipping issues on resize.

## [0.12.0] — 2026-05-18

### Added

- **Release Notes Modal:** When a new version is available, a modal now shows the full release notes so you know exactly what's changed before updating.
- **Analytics:** Added privacy-first anonymous analytics via Aptabase — only a single `app_started` event is tracked to help understand how many people use the app. No personal data is collected.

## [0.11.0] — 2026-05-17

### Added

- **Border Color:** You can now set a custom border color for each widget.

### Changed

- **Speed Widget — Full Redesign:** Completely rebuilt with a new RPM bar, shift and blink thresholds, and updated visuals for gear, speed, pit limiter, and engine info. Now uses more accurate telemetry data from the car for RPM thresholds and shift points.
- **Track Map:** Removed the class legend and sector times strip to reduce clutter.
- **Standings:** Column names are now written out in full; gap shows a placeholder when no data is available.
- **Widgets scale properly now:** All widgets resize more cleanly — fonts, spacing, and elements stay proportional no matter what size you drag the widget to.
- **Widget Settings:** Internal structure was reorganized — a settings reset may be needed in rare cases after updating.

### Fixed

- Various layout and scaling issues across multiple widgets.

## [0.10.1] — 2026-05-12

### Fixed

- **Chassis Widget:** Fixed an issue where widget settings might not be saved or reset, causing the widget to not work.

## [0.10.0] — 2026-05-11

### Added

- **Smart Visibility:** Implemented a 3s telemetry timeout that hides widgets when data stops, while keeping the background connection to iRacing active.

### Changed

- **Performance Engine:** Implemented GPU layer promotion and event bundling to significantly reduce CPU overhead and eliminate micro-stutters.
- **Optimized Telemetry:** The Rust backend now skips empty telemetry bundles, reducing unnecessary IPC traffic.
- **Core Refactoring:** Comprehensive update of the internal architecture for better stability and faster state synchronization.
- **Fuel Widget (Major Overhaul):**
  - **Visual Redesign:** Complete refresh for better readability and style consistency across all components.
  - **Pit Strategy Estimation:** Now calculates total fuel needed, required number of stops, and recommended "Equal Split" amounts for better strategy planning.
  - **Dynamic Color Logic:** The "LAPS LEFT" card background now dynamically reacts to your custom low-fuel warning threshold.
  - **Smarter Fuel Chart:** Added dynamic bar widths and adaptive X-axis labels; fixed data slicing and history freezing issues between sessions.
  - **Strategic Clarity:** "EST. FINISH" now uses neutral coloring for deficits to reduce strategic noise, turning green only when a finish is confirmed.
- **Standardized Styling:** Unified border styles, padding, and font sizes across all widget information cards.

### Fixed

- **Startup Polish:** Eliminated the brief transparent window flash or flicker during application startup.
- **Weather Widget:** Fixed cardinal direction labels (N, S, E, W) to remain upright and readable even when the compass rotates.
- **UI Constraints:** Fixed an issue where the pit panel could extend beyond its borders or overlap other elements.
- **Stability:** Fixed potential crashes when resizing widgets to extremely small dimensions.

## [0.9.0] — 2026-05-09

### Added

- **G-Meter Widget:** A brand-new widget to track your longitudinal and lateral G-forces. It includes peak force markers and a clean, high-performance interface.
- **Estimated Lap Time:** The Lap Times widget now shows a "PRED" row, predicting your current lap time based on your live delta.
- **Update Notifications:** You will now see an alert at the top of the main window when a new version of Marble Trace is available, with a convenient update button.

### Improved

- **Smooth Performance:** Significant internal optimizations to ensure widgets update smoothly at high refresh rates without stuttering or high CPU usage.
- **Clarity in Settings:** We've renamed several widgets to be more intuitive and added helpful descriptions to the settings switches so you know exactly what each toggle does.
- **Enhanced G-Meter:** Refined the G-Meter design with better label positioning and more accurate peak reset behavior.
- **Better Drag Mode:** Drag Mode state is now perfectly synchronized across all windows.
- **Documentation:** A major update to our documentation with new screenshots and detailed descriptions of all available widgets.

### Fixed

- **Layout Fixes:** Resolved an issue where some horizontal widget layouts were too narrow.
- **Lap Timing:** Improved the reliability of "Best Lap" detection and validation.
- **Stability:** Various internal fixes to improve overall app stability and data synchronization.

## [0.8.0] — 2026-05-08

### Added

- **Sidebar:** GitHub and Discord links in the sidebar footer

### Changed

- **Standings:** Lap number value highlighted with primary color
- **Fuel Chart:** Simplified chart — only average line and top boundary line visible, all labels removed
- **App Settings:** Refactored to a single observable settings object as the source of truth

### Fixed

- **Timer Widget:** Estimate total laps as `currentLap + ceil(remaining / leaderBestLap)` for unlimited (laps-based) sessions
- **Lap Count:** Accurate lap display in Timer widget and Standings header
- **Sidebar:** Replaced deprecated `lucide-react` `Github` icon with a custom SVG component

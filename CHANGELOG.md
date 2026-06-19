# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.1] — 2026-05-12

### Исправлено

- ***Chassis Widget:** Fixed an issue where widget settings might not be saved or reset, causing the widget to not work.

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

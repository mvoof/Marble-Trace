# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

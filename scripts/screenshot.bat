@echo off
:: Usage:
::   screenshot.bat                                    -> overlay, saves to docs/assets/screenshots/overlay/
::   screenshot.bat overlay                            -> overlay window
::   screenshot.bat main                               -> main settings window
::   screenshot.bat overlay --out-dir C:\path\to\dir  -> custom output directory
::   screenshot.bat overlay --crop                     -> also crop individual widgets into <out-dir>/widgets/
::   screenshot.bat overlay --out-dir C:\path --crop  -> custom dir + crop widgets

node "%~dp0screenshot.mjs" %*

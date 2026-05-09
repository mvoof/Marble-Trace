@echo off
:: Usage:
::   screenshot.bat                          -> overlay, saves to docs/assets/screenshots/
::   screenshot.bat overlay                  -> overlay window
::   screenshot.bat main                     -> main settings window
::   screenshot.bat overlay C:\path\to\out.png

set WINDOW=%1
if "%WINDOW%"=="" set WINDOW=overlay

node "%~dp0screenshot.mjs" %WINDOW% %2

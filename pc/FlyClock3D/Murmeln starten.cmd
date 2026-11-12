@echo off
rem Doppelklick startet die Murmeluhr. Tab wechselt im Fenster zu den Fliegen.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" -marbles %*
if errorlevel 1 pause

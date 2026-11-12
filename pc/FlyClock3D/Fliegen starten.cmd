@echo off
rem Doppelklick startet die Fliegenuhr. Tab wechselt im Fenster zu den Murmeln.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %*
if errorlevel 1 pause

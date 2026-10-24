@echo off
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0A_Final_start.ps1"
exit /b

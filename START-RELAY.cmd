@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "C:\Program Files\Derivative\TouchDesigner\bin\python.exe" (
 "C:\Program Files\Derivative\TouchDesigner\bin\python.exe" A_OSC_RELAY.py
) else (
 python A_OSC_RELAY.py
)
pause

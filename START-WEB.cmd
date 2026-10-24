@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo 請先安裝 Node.js，再重新執行。
 pause
 exit /b 1
)
echo A 區展覽控制 http://localhost:8788/A_ZONE_OSC.html
node server.mjs
pause

@echo off
setlocal enabledelayedexpansion
title Petrolina Mock OPT Server

rem ---------------------------------------------------------------------------
rem  Starts the Petrolina mock OPT server on any Windows PC.
rem
rem  Copy three files into one folder and run this:
rem      server.js
rem      package.json
rem      start-petrolina-server.bat
rem
rem  Everything else - dependencies, the firewall rule, the address to enter on
rem  the terminal - is handled below.
rem ---------------------------------------------------------------------------

rem Work from the folder this file lives in, not from wherever it was launched.
cd /d "%~dp0"

echo.
echo ===========================================================
echo   PETROLINA MOCK OPT SERVER
echo ===========================================================
echo.

rem -- 1. Node present? -------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
    echo [X] Node.js is not installed, or is not on the PATH.
    echo.
    echo     Install the LTS version from https://nodejs.org
    echo     then close this window and run this file again.
    echo.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node --version') do set NODEVER=%%v
echo  [OK] Node.js !NODEVER!

rem -- 2. The server itself ---------------------------------------------------
if not exist "server.js" (
    echo  [X] server.js is not in this folder.
    echo.
    echo      Copy server.js and package.json next to this file.
    echo.
    pause
    exit /b 1
)
echo  [OK] server.js found

rem -- 3. Dependencies --------------------------------------------------------
rem  Only express is needed; everything else the server uses is built into Node.
if exist "node_modules\express" (
    echo  [OK] Dependencies already installed
) else (
    echo  [..] Installing dependencies, this needs internet and takes a moment
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo  [X] npm install failed.
        echo.
        echo      With no internet on this PC, copy the node_modules folder
        echo      from a machine that has it and run this file again.
        echo.
        pause
        exit /b 1
    )
    echo  [OK] Dependencies installed
)

rem -- 4. Firewall ------------------------------------------------------------
rem  The terminal connects in from the network, so inbound 3000 must be open.
rem  Adding the rule needs administrator rights; without them, say so plainly
rem  rather than starting a server the terminal will not be able to reach.
set PORT=3000
if not "%~1"=="" set PORT=%~1

net session >nul 2>&1
if errorlevel 1 (
    echo  [WARN] Not running as administrator - firewall rule not checked.
    echo       If the terminal cannot connect, right-click this file and
    echo       choose "Run as administrator" once.
) else (
    netsh advfirewall firewall show rule name="Petrolina Mock OPT Server" >nul 2>&1
    if errorlevel 1 (
        netsh advfirewall firewall add rule name="Petrolina Mock OPT Server" ^
            dir=in action=allow protocol=TCP localport=!PORT! profile=any >nul 2>&1
        if errorlevel 1 (
            echo  [WARN] Could not add the firewall rule - open TCP !PORT! by hand.
        ) else (
            echo  [OK] Firewall opened for TCP !PORT!
        )
    ) else (
        echo  [OK] Firewall rule already present
    )
)

rem -- 5. Addresses -----------------------------------------------------------
rem  A PC often has several. The terminal must use the one on its own subnet,
rem  so list them all rather than guessing.
echo.
echo  -----------------------------------------------------------
echo   Enter ONE of these in the terminal: Settings -^> SERVER
echo  -----------------------------------------------------------
for /f "delims=" %%a in ('powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } ^| ForEach-Object { '   http://' + $_.IPAddress + ':!PORT!   (' + (Get-NetAdapter -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue).Name + ')' }" 2^>nul') do echo %%a
echo  -----------------------------------------------------------
echo   Pick the address on the same network as the terminal.
echo   Dashboard: open any of the above in a browser.
echo.

rem -- 6. Run -----------------------------------------------------------------
echo  Starting. Leave this window open - closing it stops the server.
echo  Press Ctrl+C to stop.
echo.
echo ===========================================================
echo.

set PORT=!PORT!
node server.js

rem  Reached when the server exits or is stopped.
echo.
echo ===========================================================
echo  Server stopped.
echo ===========================================================
pause

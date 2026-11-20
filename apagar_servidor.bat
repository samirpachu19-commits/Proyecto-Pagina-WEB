@echo off
title Apagar servidor Beef
echo Apagando el servidor Beef...

set ENCONTRADO=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /T /F >nul 2>nul
    set ENCONTRADO=1
)

if "%ENCONTRADO%"=="1" (
    echo Listo, el servidor esta apagado.
) else (
    echo El servidor ya estaba apagado.
)
timeout /t 3 >nul

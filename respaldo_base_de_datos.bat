@echo off
title Respaldo de la base de datos Beef
cd /d "%~dp0"

set PGDUMP=
for /d %%v in ("C:\Program Files\PostgreSQL\*") do (
    if exist "%%v\bin\pg_dump.exe" set "PGDUMP=%%v\bin\pg_dump.exe"
)
if "%PGDUMP%"=="" (
    echo No encontre pg_dump.exe. Revisa que PostgreSQL este instalado en C:\Program Files\PostgreSQL
    pause
    exit /b 1
)

if not exist respaldos mkdir respaldos
for /f %%f in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set FECHA=%%f

echo Haciendo respaldo de Beef_db... (te pedira la contrasena de postgres)
"%PGDUMP%" -h localhost -U postgres -F c -f "respaldos\Beef_db_%FECHA%.backup" Beef_db
if errorlevel 1 (
    echo Hubo un error. Revisa la contrasena y que el servidor de PostgreSQL este encendido.
    pause
    exit /b 1
)

forfiles /p respaldos /m *.backup /d -30 /c "cmd /c del @path" >nul 2>nul

echo Listo: respaldos\Beef_db_%FECHA%.backup
timeout /t 5 >nul

@echo off
title Servidor Beef
cd /d "%~dp0"

echo ============================================
echo   SERVIDOR BEEF
echo   Pagina:  http://localhost:5000
echo   Panel:   http://localhost:5000/admin
echo   Para apagar: cierra esta ventana
echo ============================================
echo.

set PY=python
where python >nul 2>nul || set PY=py

%PY% -c "import waitress" >nul 2>nul || %PY% -m pip install waitress

start "" /min cmd /c "timeout /t 3 /nobreak >nul & start "" http://localhost:5000 & start "" http://localhost:5000/admin"

%PY% app.py

echo.
echo El servidor se detuvo. Si hubo un error, aparece arriba.
pause

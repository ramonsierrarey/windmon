@echo off
chcp 65001 >nul
echo ====================================================================
echo   WindMon Burguillo - Servidor Web y Movil (PWA)
echo ====================================================================
echo.
echo Direcciones IP de tu equipo para abrir desde el movil (misma WiFi):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    echo   👉 http://%%a:8000
)
echo.
echo Abriendo http://localhost:8000 en tu navegador...
start http://localhost:8000
python "%~dp0server.py"
pause

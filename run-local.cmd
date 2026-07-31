@echo off
REM Sobe o projeto localmente: instala dependencias se preciso e inicia o Vite na porta 8080.
cd /d "%~dp0"
if not exist "node_modules" (
  echo [run-local] Instalando dependencias...
  call npm install --no-audit --no-fund || exit /b 1
)
echo [run-local] Subindo o dev server em http://localhost:8080
call npm run dev -- %*

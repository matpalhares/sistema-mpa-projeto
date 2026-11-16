@echo off
rem Sistema MPA Projeto: clique duas vezes para abrir (Windows).
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run build
start "" http://localhost:3000
call npm run start
pause

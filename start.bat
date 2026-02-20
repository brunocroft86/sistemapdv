@echo off
cd /d "%~dp0"
start http://localhost:3000
:: O ponto abaixo diz para usar o node.exe desta pasta, não do Windows
.\node.exe server.js
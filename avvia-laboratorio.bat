@echo off
title Laboratorio Anatomico 3D & VR
echo Avvio del server locale per Three.js e WebXR...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0server.ps1"
pause

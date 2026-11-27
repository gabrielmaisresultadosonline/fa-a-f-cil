@echo off
title Auxiliar MotionMRO
powershell -NoProfile -Command "$p=Join-Path $env:TEMP 'motionmro-helper.ps1'; Invoke-WebRequest 'https://raw.githubusercontent.com/gabrielmaisresultadosonline/fa-a-f-cil/main/public/motionmro-helper.ps1' -OutFile $p; powershell -NoProfile -ExecutionPolicy Bypass -File $p"
pause
$ErrorActionPreference = 'Stop'
$Base = Join-Path $env:LOCALAPPDATA 'MotionMRO\helper'
New-Item -ItemType Directory -Force $Base | Out-Null
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
}
function Require-Tool($Command, $Package) {
  if (!(Get-Command $Command -ErrorAction SilentlyContinue)) {
    if (!(Get-Command winget -ErrorAction SilentlyContinue)) { throw 'Instale o Instalador de Aplicativos da Microsoft Store e tente novamente.' }
    & winget install --id $Package --exact --source winget --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "Não foi possível instalar $Package." }
    Refresh-Path
  }
}
Require-Tool 'node' 'OpenJS.NodeJS.LTS'
Require-Tool 'python' 'Python.Python.3.12'
Require-Tool 'ffmpeg' 'Gyan.FFmpeg'
$Venv = Join-Path $Base 'python'
if (!(Test-Path "$Venv\Scripts\python.exe")) {
  & python -m venv $Venv
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível preparar o Python.' }
}
& "$Venv\Scripts\python.exe" -m pip install --no-cache-dir --upgrade 'yt-dlp[default]'
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível atualizar o downloader.' }
Invoke-WebRequest 'https://raw.githubusercontent.com/gabrielmaisresultadosonline/fa-a-f-cil/main/public/motionmro-helper.mjs' -OutFile "$Base\helper.mjs"
$env:YTDLP_COMMAND = "$Venv\Scripts\yt-dlp.exe"
Set-Location $Base
& node "$Base\helper.mjs"
param([Parameter(Mandatory=$true)][string]$NodePath,[Parameter(Mandatory=$true)][string]$ProtonCliPath,[string]$ProxyUrl)
$ErrorActionPreference='Stop'
if($ProxyUrl){$env:HTTPS_PROXY=$ProxyUrl}
$env:PROTON_DRIVE_CLI=$ProtonCliPath
$logDir=Join-Path $PSScriptRoot '../data/proton-sync'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log=Join-Path $logDir 'last-run.log'
& $NodePath (Join-Path $PSScriptRoot 'proton-sync.mjs') *> $log
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& $NodePath (Join-Path $PSScriptRoot 'publish-pages.mjs') *>> $log
exit $LASTEXITCODE

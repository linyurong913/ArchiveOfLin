param([Parameter(Mandatory=$true)][string]$NodePath,[Parameter(Mandatory=$true)][string]$ProtonCliPath,[string]$ProxyUrl)
$ErrorActionPreference='Stop'
$OutputEncoding=[System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=$OutputEncoding
if($ProxyUrl){$env:HTTPS_PROXY=$ProxyUrl}
$env:PROTON_DRIVE_CLI=$ProtonCliPath
$logDir=Join-Path $PSScriptRoot '../data/proton-sync'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log=Join-Path $logDir 'last-run.log'
# Windows PowerShell 5.1 treats native stderr as ErrorRecord. A harmless
# Node warning must not terminate its child before lock cleanup completes.
$ErrorActionPreference='Continue'
& $NodePath (Join-Path $PSScriptRoot 'proton-sync.mjs') *> $log
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& $NodePath (Join-Path $PSScriptRoot 'publish-pages.mjs') *>> $log
exit $LASTEXITCODE

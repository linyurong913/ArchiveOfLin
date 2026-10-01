param([Parameter(Mandatory=$true)][string]$NodePath,[Parameter(Mandatory=$true)][string]$ProtonCliPath,[string]$ProxyUrl,[string]$GitHubCliPath)
$ErrorActionPreference='Stop'
$runner=Join-Path $PSScriptRoot 'sync-and-publish.ps1'
if(!$GitHubCliPath){$GitHubCliPath=(Get-Command gh -ErrorAction Stop).Source}
foreach($p in @($NodePath,$ProtonCliPath,$runner,$GitHubCliPath)){if(!(Test-Path -LiteralPath $p)){throw "Required file missing: $p"}}
foreach($v in @($NodePath,$ProtonCliPath,$runner,$ProxyUrl,$GitHubCliPath)){if($v -match '["\r\n]'){throw 'Invalid argument'}}
# Scheduled tasks may not see the caller's redirected AppData configuration.
# Copy only the keyring-backed host configuration, never a plaintext token.
$sourceConfig=if($env:GH_CONFIG_DIR){$env:GH_CONFIG_DIR}elseif($env:XDG_CONFIG_HOME){Join-Path $env:XDG_CONFIG_HOME 'gh'}else{Join-Path $env:APPDATA 'GitHub CLI'}
$hostsFile=Join-Path $sourceConfig 'hosts.yml'
if(!(Test-Path -LiteralPath $hostsFile)){throw 'GitHub host configuration missing; run gh auth login first.'}
$hostsText=Get-Content -LiteralPath $hostsFile -Raw
if($hostsText -match '(?m)^\s*oauth_token\s*:'){throw 'Use GitHub CLI keyring authentication; plaintext token configuration is not copied.'}
$privateConfig=Join-Path $PSScriptRoot '../data/proton-sync/github'
New-Item -ItemType Directory -Force -Path $privateConfig | Out-Null
$destination=Join-Path $privateConfig 'hosts.yml'
if([IO.Path]::GetFullPath($hostsFile) -ne [IO.Path]::GetFullPath($destination)){Copy-Item -LiteralPath $hostsFile -Destination $destination}
$arguments="-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$runner`" -NodePath `"$NodePath`" -ProtonCliPath `"$ProtonCliPath`""
if($ProxyUrl){$arguments+=" -ProxyUrl `"$ProxyUrl`""}
$arguments+=" -GitHubCliPath `"$GitHubCliPath`""
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
$trigger=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(15) -RepetitionInterval (New-TimeSpan -Minutes 15)
$principal=New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 4) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'ArchiveOfLin-ProtonSync' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Sync only the Lin archive metadata and password-protected Proton links; publish static GitHub Pages.' -Force | Select-Object TaskName,State

param([Parameter(Mandatory=$true)][string]$NodePath,[Parameter(Mandatory=$true)][string]$ProtonCliPath,[string]$ProxyUrl)
$ErrorActionPreference='Stop'
$runner=Join-Path $PSScriptRoot 'sync-and-publish.ps1'
foreach($p in @($NodePath,$ProtonCliPath,$runner)){if(!(Test-Path -LiteralPath $p)){throw "Required file missing: $p"}}
foreach($v in @($NodePath,$ProtonCliPath,$runner,$ProxyUrl)){if($v -match '["\r\n]'){throw 'Invalid argument'}}
$arguments="-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$runner`" -NodePath `"$NodePath`" -ProtonCliPath `"$ProtonCliPath`""
if($ProxyUrl){$arguments+=" -ProxyUrl `"$ProxyUrl`""}
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
$trigger=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(15) -RepetitionInterval (New-TimeSpan -Minutes 15)
$principal=New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 4) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'ArchiveOfLin-ProtonSync' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Sync only the Lin archive metadata and password-protected Proton links; publish static GitHub Pages.' -Force | Select-Object TaskName,State

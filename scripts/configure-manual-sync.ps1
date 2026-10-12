param(
  [Parameter(Mandatory=$true)][string]$NodePath,
  [Parameter(Mandatory=$true)][string]$ProtonCliPath,
  [string]$ProxyUrl,
  [string]$GitHubCliPath
)
$ErrorActionPreference='Stop'
if(!$GitHubCliPath){$GitHubCliPath=(Get-Command gh -ErrorAction Stop).Source}
foreach($path in @($NodePath,$ProtonCliPath,$GitHubCliPath)){if(!(Test-Path -LiteralPath $path)){throw "Required file missing: $path"}}
if($ProxyUrl){$uri=[Uri]$ProxyUrl;if(!$uri.IsAbsoluteUri -or $uri.Scheme -notin @('http','https')){throw 'ProxyUrl must be an http or https URL.'}}
$privateDir=Join-Path $PSScriptRoot '../data/proton-sync'
New-Item -ItemType Directory -Force -Path $privateDir | Out-Null
# Copy only the GitHub CLI host configuration; keyring credentials remain in Windows.
$sourceConfig=if($env:GH_CONFIG_DIR){$env:GH_CONFIG_DIR}elseif($env:XDG_CONFIG_HOME){Join-Path $env:XDG_CONFIG_HOME 'gh'}else{Join-Path $env:APPDATA 'GitHub CLI'}
$hostsFile=Join-Path $sourceConfig 'hosts.yml'
if(!(Test-Path -LiteralPath $hostsFile)){throw 'GitHub host configuration missing; run gh auth login first.'}
$hostsText=Get-Content -LiteralPath $hostsFile -Raw
if($hostsText -match '(?m)^\s*oauth_token\s*:'){throw 'Use GitHub CLI keyring authentication; plaintext token configuration is not copied.'}
$githubDir=Join-Path $privateDir 'github';New-Item -ItemType Directory -Force -Path $githubDir | Out-Null
$destination=Join-Path $githubDir 'hosts.yml'
if([IO.Path]::GetFullPath($hostsFile) -ne [IO.Path]::GetFullPath($destination)){Copy-Item -LiteralPath $hostsFile -Destination $destination -Force}
$config=[ordered]@{nodePath=$NodePath;protonCliPath=$ProtonCliPath;proxyUrl=$ProxyUrl;gitHubCliPath=$GitHubCliPath}|ConvertTo-Json -Compress
$target=Join-Path $privateDir 'manual-sync.json';$temporary="$target.tmp"
[IO.File]::WriteAllText($temporary,$config,[Text.UTF8Encoding]::new($false));Move-Item -LiteralPath $temporary -Destination $target -Force
Write-Output 'Manual Proton sync is configured for the local admin page.'

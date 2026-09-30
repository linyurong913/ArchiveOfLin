$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$libraryNode = Get-Command node -ErrorAction SilentlyContinue
if ($libraryNode) { $libraryNodePath = $libraryNode.Source } else {
  $libraryNodePath = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
}
if (-not (Test-Path -LiteralPath $libraryNodePath)) { throw '请先安装 Node.js 24 或更高版本，再运行此脚本。' }
Write-Host '文献目录：http://127.0.0.1:8787'
Write-Host '馆藏管理：http://127.0.0.1:8787/admin'
Write-Host '关闭此窗口会停止服务。'
& $libraryNodePath (Join-Path $PSScriptRoot 'server.mjs')

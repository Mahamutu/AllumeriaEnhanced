param(
    [Parameter(Mandatory = $true)]
    [string]$GamePath
)

$ErrorActionPreference = 'Stop'
$game = (Resolve-Path -LiteralPath $GamePath).Path
if (-not (Test-Path -LiteralPath (Join-Path $game 'Allumeria.exe'))) {
    throw 'Allumeria.exe was not found in GamePath.'
}

$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$loaderCandidates = @(
    (Join-Path $project 'Loader.dll'),
    (Join-Path $project 'src\bin\Release\net10.0\Loader.dll')
)
$loader = $loaderCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $loader) {
    throw 'Build the loader first or place Loader.dll beside install.ps1.'
}

$modRoot = Join-Path $game 'mods\AllumeriaEnhanced'
$baseline = Join-Path $modRoot 'original-shaders'
New-Item -ItemType Directory -Force -Path $modRoot | Out-Null
if (-not (Test-Path -LiteralPath $baseline)) {
    Copy-Item -LiteralPath (Join-Path $game 'res\shaders') -Destination $baseline -Recurse
}

Copy-Item -LiteralPath (Join-Path $project 'shaderpacks') -Destination $modRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $project 'assets') -Destination $modRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $project 'README_PL.md') -Destination $modRoot -Force
Copy-Item -LiteralPath (Join-Path $project 'uninstall.ps1') -Destination $modRoot -Force
Copy-Item -LiteralPath $loader -Destination (Join-Path $game 'mods\Loader.dll') -Force

Write-Host 'Installed Allumeria Enhanced. Restart Allumeria.'

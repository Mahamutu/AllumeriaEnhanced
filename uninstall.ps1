$ErrorActionPreference = 'Stop'
$modRoot = $PSScriptRoot
$gameRoot = [IO.Path]::GetFullPath((Join-Path $modRoot '..\..'))
$expectedModRoot = [IO.Path]::GetFullPath((Join-Path $gameRoot 'mods\AllumeriaEnhanced'))

if ([IO.Path]::GetFullPath($modRoot) -ne $expectedModRoot -or
    -not (Test-Path -LiteralPath (Join-Path $gameRoot 'Allumeria.exe'))) {
    throw "Run this script from mods/AllumeriaEnhanced inside the game directory."
}
if (Get-Process Allumeria -ErrorAction SilentlyContinue) {
    throw "Close the game before uninstalling."
}

$original = Join-Path $modRoot 'original-shaders'
$target = Join-Path $gameRoot 'res\shaders'
$loader = Join-Path $gameRoot 'mods\Loader.dll'
$disabledLoader = Join-Path $gameRoot ('mods\Loader.dll.disabled-' + [Guid]::NewGuid().ToString('N'))

if (-not (Test-Path -LiteralPath $original)) {
    throw "Original shader backup is missing: $original"
}

Copy-Item -Path (Join-Path $original '*') -Destination $target -Recurse -Force
if (Test-Path -LiteralPath $loader) {
    Move-Item -LiteralPath $loader -Destination $disabledLoader -Force
}

Write-Host 'Allumeria Enhanced disabled and original shaders restored.'

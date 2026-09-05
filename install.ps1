[CmdletBinding()]
param(
    [string]$GamePath = $env:ALLUMERIA_GAME_PATH,
    [string]$ArchiveUrl = 'https://github.com/Mahamutu/AllumeriaEnhanced/releases/latest/download/Allumeria-Enhanced-Aurora-Classic-current.zip'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Find-Allumeria {
    param([string]$RequestedPath)

    $candidates = [System.Collections.Generic.List[string]]::new()
    if ($RequestedPath) {
        $candidates.Add($RequestedPath)
    }
    $candidates.Add((Get-Location).Path)
    if (${env:ProgramFiles(x86)}) {
        $candidates.Add((Join-Path ${env:ProgramFiles(x86)} 'Steam\steamapps\common\Allumeria'))
    }
    if ($env:ProgramFiles) {
        $candidates.Add((Join-Path $env:ProgramFiles 'Steam\steamapps\common\Allumeria'))
    }

    $steamRoots = [System.Collections.Generic.List[string]]::new()
    foreach ($registryPath in @(
        'HKCU:\Software\Valve\Steam',
        'HKLM:\Software\WOW6432Node\Valve\Steam',
        'HKLM:\Software\Valve\Steam'
    )) {
        try {
            $steam = Get-ItemProperty -LiteralPath $registryPath -ErrorAction Stop
            if ($steam.SteamPath) { $steamRoots.Add($steam.SteamPath) }
            if ($steam.InstallPath) { $steamRoots.Add($steam.InstallPath) }
        }
        catch {
            # Steam may not be registered in every location.
        }
    }

    foreach ($steamRoot in $steamRoots) {
        $candidates.Add((Join-Path $steamRoot 'steamapps\common\Allumeria'))
        $libraryFile = Join-Path $steamRoot 'steamapps\libraryfolders.vdf'
        if (-not (Test-Path -LiteralPath $libraryFile)) { continue }
        $vdf = Get-Content -Raw -LiteralPath $libraryFile
        foreach ($match in [regex]::Matches($vdf, '"path"\s+"([^"]+)"')) {
            $libraryRoot = $match.Groups[1].Value.Replace('\\', '\')
            $candidates.Add((Join-Path $libraryRoot 'steamapps\common\Allumeria'))
        }
    }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'Allumeria.exe'))) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw 'Allumeria was not found. Set ALLUMERIA_GAME_PATH or run with -GamePath "C:\path\to\Allumeria".'
}

function Copy-DirectoryContents {
    param([string]$Source, [string]$Destination)
    if (-not (Test-Path -LiteralPath $Source)) {
        throw "Required directory is missing: $Source"
    }
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | Copy-Item -Destination $Destination -Recurse -Force
}

$game = Find-Allumeria $GamePath
if (Get-Process -Name Allumeria -ErrorAction SilentlyContinue) {
    throw 'Close Allumeria completely before installing.'
}

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$sourceRoot = $scriptRoot
$temporaryRoot = $null

try {
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot 'mods\Loader.dll'))) {
        $temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ('AllumeriaEnhanced-' + [Guid]::NewGuid().ToString('N'))
        $archive = Join-Path $temporaryRoot 'Allumeria-Enhanced.zip'
        $sourceRoot = Join-Path $temporaryRoot 'package'
        New-Item -ItemType Directory -Force -Path $sourceRoot | Out-Null
        Write-Host 'Downloading the latest Allumeria Enhanced release...'
        Invoke-WebRequest -UseBasicParsing -Uri $ArchiveUrl -OutFile $archive
        Expand-Archive -LiteralPath $archive -DestinationPath $sourceRoot -Force
    }

    $loader = Join-Path $sourceRoot 'mods\Loader.dll'
    $packageMod = Join-Path $sourceRoot 'mods\AllumeriaEnhanced'
    if (-not (Test-Path -LiteralPath $loader)) {
        throw 'The downloaded package does not contain mods\Loader.dll.'
    }

    $modRoot = Join-Path $game 'mods\AllumeriaEnhanced'
    $baseline = Join-Path $modRoot 'original-shaders'
    New-Item -ItemType Directory -Force -Path $modRoot | Out-Null
    if (-not (Test-Path -LiteralPath $baseline)) {
        Copy-Item -LiteralPath (Join-Path $game 'res\shaders') -Destination $baseline -Recurse
    }

    $oldPacks = Join-Path $modRoot 'shaderpacks'
    if (Test-Path -LiteralPath $oldPacks) {
        $packBackup = Join-Path $modRoot ('shaderpacks.backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
        Move-Item -LiteralPath $oldPacks -Destination $packBackup
    }

    Copy-DirectoryContents (Join-Path $packageMod 'shaderpacks') (Join-Path $modRoot 'shaderpacks')
    Copy-DirectoryContents (Join-Path $packageMod 'assets') (Join-Path $modRoot 'assets')
    foreach ($file in @('README_PL.md', 'uninstall.ps1')) {
        $sourceFile = Join-Path $packageMod $file
        if (Test-Path -LiteralPath $sourceFile) {
            Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $modRoot $file) -Force
        }
    }
    Copy-Item -LiteralPath $loader -Destination (Join-Path $game 'mods\Loader.dll') -Force

    Write-Host "Installed Allumeria Enhanced in: $game"
    Write-Host 'Start Allumeria and enable the mod under Settings > Allumeria Enhanced.'
}
finally {
    if ($temporaryRoot -and (Test-Path -LiteralPath $temporaryRoot)) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}

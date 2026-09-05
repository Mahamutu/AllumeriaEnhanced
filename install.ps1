# Allumeria Enhanced Windows Installer
# Requires PowerShell 5.1+

$ErrorActionPreference = "Stop"

$RepoUser = "Mahamutu"
$RepoName = "AllumeriaEnhanced"
$UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AllumeriaInstaller"

function Get-GamePath {
    if ($env:ALLUMERIA_GAME_PATH -and (Test-Path $env:ALLUMERIA_GAME_PATH)) {
        return $env:ALLUMERIA_GAME_PATH
    }

    $SteamPaths = @(
        "C:\Program Files (x86)\Steam\steamapps\common\Allumeria",
        "C:\Program Files\Steam\steamapps\common\Allumeria",
        "D:\SteamLibrary\steamapps\common\Allumeria",
        "E:\SteamLibrary\steamapps\common\Allumeria"
    )

    foreach ($path in $SteamPaths) {
        if (Test-Path $path) {
            return $path
        }
    }

    # Try searching Steam libraryfolders.vdf if default paths fail
    $VdfPath = "C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf"
    if (Test-Path $VdfPath) {
        $vdfContent = Get-Content $VdfPath
        foreach ($line in $vdfContent) {
            if ($line -match '"path"\s+"([^"]+)"') {
                $libPath = Join-Path $matches[1] "steamapps\common\Allumeria"
                if (Test-Path $libPath) {
                    return $libPath
                }
            }
        }
    }

    return $null
}

$InstallDir = Get-GamePath

if (-not $InstallDir) {
    Write-Error "Could not automatically locate the Allumeria installation folder.`nPlease set the ALLUMERIA_GAME_PATH environment variable to your game directory and run this script again."
    exit 1
}

Write-Host "Found Allumeria directory at: $InstallDir" -ForegroundColor Green

# Fetch Latest Release Metadata
$ApiUrl = "https://api.github.com/repos/$RepoUser/$RepoName/releases/latest"
Write-Host "Checking for latest release..." -ForegroundColor Cyan

try {
    $ReleaseData = Invoke-RestMethod -Uri $ApiUrl -UserAgent $UserAgent -Headers @{ "Accept" = "application/vnd.github.v3+json" }
} catch {
    Write-Error "Failed to query GitHub API for releases: $_"
    exit 1
}

$Asset = $ReleaseData.assets | Where-Object { $_.name -like "*.zip" } | Select-Object -First 1

if (-not $Asset) {
    Write-Error "No valid .zip release asset found in the latest GitHub release."
    exit 1
}

$ArchiveUrl = $Asset.browser_download_url
$TempZip = Join-Path $env:TEMP "AllumeriaEnhanced_latest.zip"
$TempExtract = Join-Path $env:TEMP "AllumeriaEnhanced_Extract"

Write-Host "Downloading latest Allumeria Enhanced release ($($Asset.name))..." -ForegroundColor Cyan
Invoke-WebRequest -UseBasicParsing -UserAgent $UserAgent -Uri $ArchiveUrl -OutFile $TempZip

if (Test-Path $TempExtract) {
    Remove-Item $TempExtract -Recurse -Force
}

Write-Host "Extracting files..." -ForegroundColor Cyan
Expand-Archive -Path $TempZip -DestinationPath $TempExtract -Force

# Locate extracted contents (handles both top-level files and nested folders)
$SourcePath = $TempExtract
$ChildItems = Get-ChildItem $TempExtract
if ($ChildItems.Count -eq 1 -and $ChildItems[0].PSIsContainer) {
    $SourcePath = $ChildItems[0].FullName
}

$TargetShadersDir = Join-Path $InstallDir "res\shaders"

# Backup existing shaders if not already backed up
$BackupDir = Join-Path $InstallDir "res\shaders_backup"
if (Test-Path $TargetShadersDir) {
    if (-not (Test-Path $BackupDir)) {
        Write-Host "Creating backup of original shaders at: $BackupDir" -ForegroundColor Yellow
        Copy-Item -Path $TargetShadersDir -Destination $BackupDir -Recurse -Force
    }
} else {
    New-Item -ItemType Directory -Path $TargetShadersDir -Force | Out-Null
}

Write-Host "Installing Allumeria Enhanced..." -ForegroundColor Green
Copy-Item -Path "$SourcePath\*" -Destination $TargetShadersDir -Recurse -Force

# Cleanup
Remove-Item $TempZip -Force -ErrorAction SilentlyContinue
Remove-Item $TempExtract -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`nAllumeria Enhanced successfully installed!" -ForegroundColor Green

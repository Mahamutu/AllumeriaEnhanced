# Allumeria Enhanced Windows Uninstaller
# Requires PowerShell 5.1+

$ErrorActionPreference = "Stop"

function Get-GamePath {
    if ($env:ALLUMERIA_GAME_PATH -and (Test-Path (Join-Path $env:ALLUMERIA_GAME_PATH "Allumeria.exe"))) {
        return $env:ALLUMERIA_GAME_PATH
    }

    $SteamPaths = @(
        "E:\SteamLibrary\steamapps\common\Allumeria",
        "C:\Program Files (x86)\Steam\steamapps\common\Allumeria",
        "C:\Program Files\Steam\steamapps\common\Allumeria",
        "D:\SteamLibrary\steamapps\common\Allumeria",
        "F:\SteamLibrary\steamapps\common\Allumeria"
    )

    foreach ($path in $SteamPaths) {
        if (Test-Path (Join-Path $path "Allumeria.exe")) {
            return $path
        }
    }

    # Try searching Steam libraryfolders.vdf
    $VdfPaths = @(
        "C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf",
        "C:\Program Files\Steam\steamapps\libraryfolders.vdf"
    )

    foreach ($VdfPath in $VdfPaths) {
        if (Test-Path $VdfPath) {
            $vdfContent = Get-Content $VdfPath
            foreach ($line in $vdfContent) {
                if ($line -match '"path"\s+"([^"]+)"') {
                    $rawPath = $matches[1] -replace '\\\\', '\'
                    $libPath = Join-Path $rawPath "steamapps\common\Allumeria"
                    if (Test-Path (Join-Path $libPath "Allumeria.exe")) {
                        return $libPath
                    }
                }
            }
        }
    }

    return $null
}

$InstallDir = Get-GamePath

if (-not $InstallDir) {
    Write-Host "Error: Could not find Allumeria.exe in standard Steam locations." -ForegroundColor Red
    Write-Host "Please set ALLUMERIA_GAME_PATH environment variable to your game folder." -ForegroundColor Yellow
    exit 1
}

Write-Host "Found Allumeria game directory at: $InstallDir" -ForegroundColor Green
Write-Host "Uninstalling Allumeria Enhanced..." -ForegroundColor Cyan

# Remove installed mod folders
$FoldersToRemove = @("mods", "docs")
foreach ($folder in $FoldersToRemove) {
    $targetFolder = Join-Path $InstallDir $folder
    if (Test-Path $targetFolder) {
        Write-Host "Removing folder: $folder" -ForegroundColor Yellow
        Remove-Item -Path $targetFolder -Recurse -Force
    }
}

# Remove specific installed text files
$FilesToRemove = @("README.md", "LICENSE", "INSTALL_EN.txt")
foreach ($file in $FilesToRemove) {
    $targetFile = Join-Path $InstallDir $file
    if (Test-Path $targetFile) {
        Write-Host "Removing file: $file" -ForegroundColor Yellow
        Remove-Item -Path $targetFile -Force
    }
}

# Restore backup of original shaders if backup folder exists
$BackupDir = Join-Path $InstallDir "res\shaders_backup"
$TargetShadersDir = Join-Path $InstallDir "res\shaders"

if (Test-Path $BackupDir) {
    Write-Host "Restoring original shaders from backup..." -ForegroundColor Green
    if (Test-Path $TargetShadersDir) {
        Remove-Item -Path $TargetShadersDir -Recurse -Force
    }
    Move-Item -Path $BackupDir -Destination $TargetShadersDir -Force
}

Write-Host "`nAllumeria Enhanced successfully uninstalled!" -ForegroundColor Green

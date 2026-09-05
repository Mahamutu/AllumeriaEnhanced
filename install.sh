#!/usr/bin/env bash
set -e

REPO_USER="Mahamutu"
REPO_NAME="AllumeriaEnhanced"
USER_AGENT="Mozilla/5.0 (X11; Linux x86_64) AllumeriaInstaller"

# Locate Game Directory
find_game_dir() {
    if [ -n "$ALLUMERIA_GAME_PATH" ] && [ -f "$ALLUMERIA_GAME_PATH/Allumeria.exe" ]; then
        echo "$ALLUMERIA_GAME_PATH"
        return
    fi

    # Check common Steam library paths for Allumeria.exe
    for path in \
        "$HOME/.local/share/Steam/steamapps/common/Allumeria" \
        "$HOME/.steam/steam/steamapps/common/Allumeria" \
        "$HOME/.steam/root/steamapps/common/Allumeria" \
        "/run/media/mmcblk0p1/steamapps/common/Allumeria" \
        "/media/$USER/*/steamapps/common/Allumeria" \
        "/mnt/*/steamapps/common/Allumeria"
    do
        if [ -f "$path/Allumeria.exe" ]; then
            echo "$path"
            return
        fi
    done

    echo ""
}

INSTALL_DIR=$(find_game_dir)

if [ -z "$INSTALL_DIR" ]; then
    echo -e "\033[31mError: Could not automatically locate Allumeria.exe in Steam folders.\033[0m"
    echo "Please set ALLUMERIA_GAME_PATH to your game directory and run this script again."
    exit 1
fi

echo -e "\033[32mFound Allumeria game directory at: $INSTALL_DIR\033[0m"

# Fetch Latest Release from GitHub API
API_URL="https://api.github.com/repos/$REPO_USER/$REPO_NAME/releases/latest"
echo "Checking for latest release..."

RELEASE_JSON=$(curl -sSL -A "$USER_AGENT" -H "Accept: application/vnd.github.v3+json" "$API_URL")

DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep -o '"browser_download_url": "[^"]*' | grep '\.zip"' | head -n 1 | cut -d '"' -f 4)

if [ -z "$DOWNLOAD_URL" ]; then
    echo -e "\033[31mError: Failed to find a valid .zip asset in the latest release.\033[0m"
    exit 1
fi

TEMP_ZIP="/tmp/AllumeriaEnhanced_latest.zip"
TEMP_EXTRACT="/tmp/AllumeriaEnhanced_Extract"

echo "Downloading latest release..."
curl -fL -A "$USER_AGENT" -o "$TEMP_ZIP" "$DOWNLOAD_URL"

rm -rf "$TEMP_EXTRACT"
mkdir -p "$TEMP_EXTRACT"

echo "Extracting files..."
unzip -q "$TEMP_ZIP" -d "$TEMP_EXTRACT"

# Handle top-level directory wrapper if present
SOURCE_DIR="$TEMP_EXTRACT"
if [ $(ls -1 "$TEMP_EXTRACT" | wc -l) -eq 1 ] && [ -d "$TEMP_EXTRACT"/* ]; then
    SOURCE_DIR="$TEMP_EXTRACT"/*
fi

TARGET_SHADERS_DIR="$INSTALL_DIR/res/shaders"
BACKUP_DIR="$INSTALL_DIR/res/shaders_backup"

if [ -d "$TARGET_SHADERS_DIR" ]; then
    if [ ! -d "$BACKUP_DIR" ]; then
        echo -e "\033[33mCreating backup of original shaders at: $BACKUP_DIR\033[0m"
        cp -r "$TARGET_SHADERS_DIR" "$BACKUP_DIR"
    fi
else
    mkdir -p "$TARGET_SHADERS_DIR"
fi

echo -e "\033[32mInstalling Allumeria Enhanced...\033[0m"
cp -r "$SOURCE_DIR"/* "$TARGET_SHADERS_DIR/"

# Cleanup
rm -f "$TEMP_ZIP"
rm -rf "$TEMP_EXTRACT"

echo -e "\n\033[32mAllumeria Enhanced successfully installed!\033[0m"

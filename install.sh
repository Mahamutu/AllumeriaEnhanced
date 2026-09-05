#!/usr/bin/env sh
set -eu

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
    /run/media/"$USER"/*/steamapps/common/Allumeria \
    /media/"$USER"/*/steamapps/common/Allumeria \
    /mnt/*/steamapps/common/Allumeria; do
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

for command_name in curl unzip; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Error: required command '$command_name' is not installed." >&2
    exit 1
  fi
done

# Query the latest release and download its compiled ZIP asset. The repository
# source archive does not contain mods/Loader.dll and cannot install the mod.
API_URL="https://api.github.com/repos/$REPO_USER/$REPO_NAME/releases/latest"
echo "Checking for latest release..."
RELEASE_JSON=$(curl -fsSL -A "$USER_AGENT" -H "Accept: application/vnd.github+json" "$API_URL")
DOWNLOAD_URL=$(printf '%s\n' "$RELEASE_JSON" |
  sed -n 's/.*"browser_download_url":[[:space:]]*"\([^"]*\.zip\)".*/\1/p' |
  head -n 1)

if [ -z "$DOWNLOAD_URL" ]; then
  echo "Error: no ZIP asset was found in the latest GitHub release." >&2
  exit 1
fi

TEMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/AllumeriaEnhanced.XXXXXX")
TEMP_ZIP="$TEMP_ROOT/release.zip"
TEMP_EXTRACT="$TEMP_ROOT/extracted"
trap 'rm -rf "$TEMP_ROOT"' EXIT HUP INT TERM
mkdir -p "$TEMP_EXTRACT"

echo "Downloading latest release asset..."
curl -fL -A "$USER_AGENT" -o "$TEMP_ZIP" "$DOWNLOAD_URL"

echo "Extracting files..."
unzip -q "$TEMP_ZIP" -d "$TEMP_EXTRACT"

# If an archive contains one wrapper directory, enter it. Keep SOURCE_DIR as an
# actual expanded path; assigning "$TEMP_EXTRACT"/* stores a literal asterisk.
SOURCE_DIR="$TEMP_EXTRACT"
set -- "$TEMP_EXTRACT"/*
if [ "$#" -eq 1 ] && [ -d "$1" ]; then
  SOURCE_DIR=$1
fi

if [ ! -f "$SOURCE_DIR/mods/Loader.dll" ]; then
  echo "Error: the downloaded release does not contain mods/Loader.dll." >&2
  exit 1
fi

printf '\033[32mInstalling Allumeria Enhanced into game root...\033[0m\n'
cp -a "$SOURCE_DIR"/. "$INSTALL_DIR"/

printf '\n\033[32mAllumeria Enhanced successfully installed!\033[0m\n'

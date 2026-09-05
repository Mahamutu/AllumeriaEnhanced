#!/usr/bin/env sh
set -eu

archive_url=${ALLUMERIA_ENHANCED_URL:-https://github.com/Mahamutu/AllumeriaEnhanced/releases/latest/download/Allumeria-Enhanced-Aurora-Classic-current.zip}
game_path=${ALLUMERIA_GAME_PATH:-}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --game-path)
            [ "$#" -ge 2 ] || { echo "Missing value for --game-path" >&2; exit 2; }
            game_path=$2
            shift 2
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 2
            ;;
    esac
done

find_game() {
    if [ -n "$game_path" ] && [ -f "$game_path/Allumeria.exe" ]; then
        printf '%s\n' "$game_path"
        return
    fi

    for candidate in \
        "$PWD" \
        "$HOME/.local/share/Steam/steamapps/common/Allumeria" \
        "$HOME/.steam/steam/steamapps/common/Allumeria" \
        "$HOME/.steam/root/steamapps/common/Allumeria"
    do
        if [ -f "$candidate/Allumeria.exe" ]; then
            printf '%s\n' "$candidate"
            return
        fi
    done

    echo "Allumeria was not found. Set ALLUMERIA_GAME_PATH to its Steam directory." >&2
    exit 1
}

command -v curl >/dev/null 2>&1 || { echo "curl is required." >&2; exit 1; }
command -v unzip >/dev/null 2>&1 || { echo "unzip is required." >&2; exit 1; }

game_path=$(find_game)
if command -v pgrep >/dev/null 2>&1 && pgrep -f "$game_path/Allumeria.exe" >/dev/null 2>&1; then
    echo "Close Allumeria completely before installing." >&2
    exit 1
fi

temporary_root=$(mktemp -d)
trap 'rm -rf "$temporary_root"' EXIT HUP INT TERM
archive="$temporary_root/Allumeria-Enhanced.zip"
package="$temporary_root/package"
mkdir -p "$package"

echo "Downloading the latest Allumeria Enhanced release..."
curl -fL "$archive_url" -o "$archive"
unzip -q "$archive" -d "$package"

[ -f "$package/mods/Loader.dll" ] || {
    echo "The downloaded package does not contain mods/Loader.dll." >&2
    exit 1
}

mod_root="$game_path/mods/AllumeriaEnhanced"
mkdir -p "$mod_root"
if [ ! -d "$mod_root/original-shaders" ]; then
    cp -a "$game_path/res/shaders" "$mod_root/original-shaders"
fi

if [ -d "$mod_root/shaderpacks" ]; then
    mv "$mod_root/shaderpacks" "$mod_root/shaderpacks.backup-$(date +%Y%m%d-%H%M%S)"
fi

mkdir -p "$mod_root/shaderpacks" "$mod_root/assets" "$game_path/mods"
cp -a "$package/mods/AllumeriaEnhanced/shaderpacks/." "$mod_root/shaderpacks/"
cp -a "$package/mods/AllumeriaEnhanced/assets/." "$mod_root/assets/"
for file in README_PL.md uninstall.ps1; do
    if [ -f "$package/mods/AllumeriaEnhanced/$file" ]; then
        cp -f "$package/mods/AllumeriaEnhanced/$file" "$mod_root/$file"
    fi
done
cp -f "$package/mods/Loader.dll" "$game_path/mods/Loader.dll"

echo "Installed Allumeria Enhanced in: $game_path"
echo "Start the game through Steam and enable the mod under Settings > Allumeria Enhanced."

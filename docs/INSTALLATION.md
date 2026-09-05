# Installation

## Release archive

1. Close Allumeria completely.
2. In Steam, right-click Allumeria and select **Manage > Browse local files**.
3. Back up `mods/Loader.dll`, `mods/AllumeriaEnhanced` and `res/shaders`.
4. When upgrading from a release containing more shader packs, move the old
   `mods/AllumeriaEnhanced` directory outside the game folder first. This keeps
   removed packs from remaining in the in-game list.
5. Extract the release to a temporary directory.
6. Copy its `mods` directory into the directory containing `Allumeria.exe`.
   Allow Windows to merge folders and replace this mod's existing files.
7. Verify that these files exist:

```text
Allumeria.exe
mods/Loader.dll
mods/AllumeriaEnhanced/assets/allumeria-enhanced-icon.png
mods/AllumeriaEnhanced/shaderpacks/Aurora/icon.png
mods/AllumeriaEnhanced/shaderpacks/Classic/icon.png
```

8. Start the game, open **Settings > Allumeria Enhanced**, enable the mod and
   select Aurora or Classic.

The release includes a settings snapshot. Back up your `settings.json` before
installation if you want to retain personal values.

## Source checkout

Build the loader as described in the main README, then run:

```powershell
.\install.ps1 -GamePath "C:\path\to\Allumeria"
```

The installer preserves `res/shaders` as the local baseline the first time it
runs. Start from an unmodified game shader directory when creating that backup.

## Uninstall

Close the game, open PowerShell in the game directory and run:

```powershell
powershell -ExecutionPolicy Bypass -File ".\mods\AllumeriaEnhanced\uninstall.ps1"
```

The script restores the bundled original shader backup and disables this
loader. Keep your manual backups until the game has started successfully.

## Troubleshooting

- Missing menu: confirm that `mods/Loader.dll` is directly inside `mods`.
- Missing icons: confirm that the main icon and both pack `icon.png` files were
  extracted, then fully restart the game.
- Old packs still listed: remove the old `mods/AllumeriaEnhanced` directory and
  install the current two-pack release again.
- Shader edit not visible: press F8.
- Loader update not visible: close and restart Allumeria.

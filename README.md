![Image Alt](https://github.com/Mahamutu/AllumeriaEnhanced/blob/bbb43d64ced0fc561efcff92d243fa96fa158892/Allumeria%20Enhanced%20banner.png)

Created by **Mahamutu**.

Allumeria Enhanced is a source-available shader loader and visual overhaul for
**Allumeria 0.15**. It ships with two selectable raster shader packs:
**Aurora** and **Classic**.

Aurora provides the full visual feature set. Classic keeps the game's original
look while adding restrained lighting and atmosphere.

## Features

- directional sun and moon shadow maps;
- moving cloud shadows;
- atmospheric and distance fog;
- sun and moon god rays;
- water reflections, refraction, depth tinting and caustics;
- underwater particles and animated light shafts;
- coloured local lighting for torches, lava and emissive objects;
- animated foliage with stabilized shadow handling;
- optional Aurora ambient occlusion, sharpening and depth of field;
- in-game configuration, presets and F8 shader reloading.

Allumeria exposes an OpenGL 3.3 raster pipeline. The project uses shadow maps,
screen-space ray marching and volumetric sampling rather than hardware ray
tracing.

## Requirements

- Allumeria 0.15 for Windows, or the Windows release running through Steam
  Proton on Linux;
- an OpenGL 3.3 compatible graphics card;
- a clean or backed-up copy of the game's original `res/shaders` directory.

## Installation

Close Allumeria, then use one of these commands.

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/Mahamutu/AllumeriaEnhanced/main/install.ps1 | iex
```
The Windows installer also reads Steam's registered library folders. For any
location that is not detected, set `ALLUMERIA_GAME_PATH` to the directory
containing `Allumeria.exe`. Manual installation and troubleshooting are covered in
[docs/INSTALLATION.md](docs/INSTALLATION.md). Press **F8** to reload edited
shader files; loader updates require a full game restart.

## Shader packs

| Pack | Purpose |
| --- | --- |
| Aurora | Full atmospheric, water, shadow and post-processing feature set. |
| Classic | Restrained effects that stay closer to the original presentation. |

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for settings and
[docs/SHADER_PACKS.md](docs/SHADER_PACKS.md) for custom pack metadata.

## Project structure

```text
assets/                 Mod and settings icon
shaderpacks/Aurora/     Aurora icon, manifest and shaders
shaderpacks/Classic/    Classic icon, manifest and shaders
src/                    C# loader source
docs/                   English documentation
install.ps1             Source-checkout installer
install.sh              Linux/Steam Proton installer
uninstall.ps1           Restores the backed-up original shaders
```

The game assemblies and game-owned assets are intentionally excluded. The
separate Polish game translation is not part of this repository.

## Building from source

Install the .NET 10 SDK and run:

```powershell
dotnet build src/AllumeriaEnhanced.Loader.csproj -c Release -p:AllumeriaGameDir="C:\path\to\Allumeria"
```

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) before submitting changes.

## License

This project is licensed under the
[PolyForm Noncommercial License 1.0.0](LICENSE). You may use, study, modify and
redistribute it for permitted noncommercial purposes. Commercial use requires
separate permission from the copyright holders.

Because commercial use is restricted, this is a **source-available** project
rather than OSI-approved open-source software. Allumeria and its game assets
remain the property of their respective owners and are not licensed here.

Polish documentation is available in [README_PL.md](README_PL.md).

## Credits & Assets

* **Kiwi Soda Font** by [jeti](https://fontenddev.com/fonts/kiwi-soda/) (used in header banner) – Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

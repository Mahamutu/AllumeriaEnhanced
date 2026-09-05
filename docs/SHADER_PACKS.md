# Creating a shader pack

Create a directory in `mods/AllumeriaEnhanced/shaderpacks`. A pack can override
files from the game's `res/shaders` tree and should include a `pack.json`
manifest.

```text
shaderpacks/MyPack/
  icon.png
  pack.json
  shaders/
    shader.frag
    shader.vert
```

Example:

```json
{
  "name": "My Pack",
  "version": "1.0.0",
  "description": "A short in-game description.",
  "icon": "icon.png",
  "settings": {
    "ShadowMaps": true,
    "ShadowResolution": 2048,
    "FogStrength": 0.7,
    "MoonRayStrength": 1.0
  }
}
```

The icon should be a 16x16 RGBA PNG. The loader uses nearest-neighbour sampling
and allocates a separate UI-atlas slot for every discovered pack.

Supported setting names:

```text
PostProcessing, AmbientOcclusion, Sharpening, DepthOfField,
MoonRayStrength, CloudShadowStrength, ShadowMaps, ShadowResolution,
ShadowDistance, ShadowStrength, ShadowSoftness, ShadowBias, IndirectLight,
Saturation, Contrast, Warmth, FogStrength, WaterRefraction, CloudSoftness,
Reflections, ReflectionStrength, RaySteps
```

Only include values the pack needs to change. Press F8 after shader edits. A
new pack or icon may require a full restart so the menu can rediscover it.

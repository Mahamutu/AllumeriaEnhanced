# Changelog

## 0.13.2 - 2026-09-05

- Reduced Aurora's GPU cost by caching directional and local shadow maps,
  lowering the local shadow cubemap resolution and throttling stable redraws.
- Reduced volumetric cloud, god-ray, reflection, underwater-particle and AO
  sample counts while preserving the existing visual effects.
- Added a balanced Aurora profile as the default for new installations.
- Fixed warm self-lighting on a torch held in first person.
- Stabilised moving torch shadows by sampling the cubemap from the exact light
  position used during its most recent render.
- Added smooth biome-aware colour grading that removes the excessive cyan cast
  from desert skies and distance fog without warming other biomes.

## 0.13.1 - 2026-09-05

- Fixed runtime UI icon placement by converting logical top-left atlas coordinates
  to OpenGL bottom-left upload coordinates.
- Added bounds checks, OpenGL error reporting and automatic retry when an icon
  cannot be uploaded.
- Added a loader message confirming each successfully loaded pack icon.

## 0.13.0 - 2026-09-04

- Added a true 16x16 pixel-art settings icon.
- Added independently replaceable `icon.png` files for every shader pack.
- Added manifest-driven per-pack setting overrides.
- Exposed Aurora post-processing, ambient occlusion, sharpening, depth of
  field, moon god-ray strength and cloud-shadow strength in the game menu.
- Increased Aurora moon god rays and made their strength configurable.
- Preserved phase, altitude and sunrise fading for lunar illumination.
- Kept cloud shadows configurable instead of hard-coding their darkness.
- Added GitHub-ready documentation, install script and validation workflow.

## 0.12.5

- Added moving, sun-projected cloud shadows.

## 0.12.4

- Added moon god rays occluded by the shadow map.

## 0.12.1-0.12.3

- Stabilised underwater rendering and distant geometry.
- Balanced Aurora cloud lighting.
- Added Aurora post-processing with distance-aware AO and sharpening.

# Changelog

## Unreleased

- Restored Aurora's authored game silhouette after contour thresholding made
  shallow viewing angles collapse into long straight rails; animation is now
  a subtle square-pixel luminance pulse that does not deform the geometry.
- Added a gradual winter-biome cloud fade across sunset and sunrise; visible
  clouds and their celestial occlusion now disappear together during the night.
- Fixed the shared cloud/aurora render path: Classic now preserves the game's
  original aurora formula without cloud-softening artifacts, while Aurora no
  longer discards the game's 40 world-space aurora layers and masks them behind
  its volumetric clouds.
- Aurora now enhances the game's world-space aurora object with animated,
  interwoven square-pixel strands and correct cloud occlusion. Classic keeps
  only the original game aurora without a duplicate sky effect.
- Stabilized Classic's moving held-torch shadows by sampling the cubemap from
  its last rendered light position and using its actual 256px face size.
- Removed the Linux command installer and its documentation. Release archives
  now include only the Windows installer and manual installation files.

## Installer hotfix - 2026-09-05

- Fixed the Linux installer's literal `*` source path that caused
  `cp: cannot stat '/tmp/AllumeriaEnhanced_Extract/*/.'`.
- Linux now downloads the compiled ZIP asset from the latest GitHub release
  instead of the source-code zipball, and verifies that `mods/Loader.dll` is
  present before copying files.
- Replaced fixed shared temporary paths with a unique `mktemp` directory and
  automatic cleanup.

## 0.13.3 - 2026-09-05

- Automatically recompiles and activates the selected shader pack once the game
  render context is ready; F8 is no longer required after launching the game.
- Keeps depth of field disabled by default and moves its optional blur much
  farther into the background with a smaller, smoother depth-aware kernel.
- Adds a restrained, high-threshold midday bloom lift without affecting dawn,
  night, underwater scenes or first-person held items.
- Added the missing desktop-windowing and image-library build references so the
  loader builds reproducibly with the .NET 10 SDK.

## 0.13.2 - 2026-09-05

- Added one-command installers for Windows PowerShell and Linux/Steam Proton.
- Added automatic Steam-path detection and safe shader-pack backups.
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

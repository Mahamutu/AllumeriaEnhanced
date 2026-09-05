# Allumeria Enhanced 0.13.1

This maintenance release fixes icons that were present in the package but did
not appear in the in-game settings menu.

## Changes

- Corrected the vertical coordinate used while uploading icons into the game's
  OpenGL UI atlas.
- Added an independent 16x16 icon upload for the main settings category and
  every shader pack.
- Added validation, diagnostics and retry on failed uploads.

## Installation

Extract `Allumeria-Enhanced-0.13.1.zip` directly into the Allumeria directory
and replace existing files. Fully restart the game; F8 reloads shaders but does
not reload `Loader.dll`.

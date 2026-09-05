# Allumeria Enhanced 0.13.3

- The selected shader pack now activates automatically on every game launch.
- Depth of field remains off by default. When enabled, it affects only the far
  background and uses a smoother, depth-aware sample pattern.
- Aurora receives a small high-threshold bloom increase around midday.
- The loader project now builds cleanly with the .NET 10 SDK and the libraries
  shipped with Allumeria 0.15.

Fully close the game before replacing `mods/Loader.dll`. Existing shader edits
can still be reloaded with F8 while the game is running.

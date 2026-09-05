# Configuration

Settings are available in **Settings > Allumeria Enhanced** and are stored in
`mods/AllumeriaEnhanced/settings.json`.

| Setting | Effect |
| --- | --- |
| Enabled | Enables or disables the visual overhaul. |
| Shader Pack | Selects Aurora or Classic. |
| Preset | Applies Performance, Balanced, Cinematic or Ultra values. |
| Shadow Maps | Enables directional sun and moon shadows. |
| Shadow Resolution | Selects the shadow-map resolution. |
| Shadow Distance | Controls the covered world distance. |
| Shadow Strength | Controls directional shadow darkness. |
| Shadow Softness | Controls filtered shadow edges. |
| Shadow Bias | Reduces self-shadowing artifacts; excessive values detach shadows. |
| Indirect Light | Controls ambient light in shaded areas. |
| Saturation | Controls colour intensity. |
| Contrast | Controls tonal separation. |
| Warmth | Shifts grading between cool and warm tones. |
| Fog | Controls atmospheric fog density. |
| Water | Controls refraction strength. |
| Clouds | Controls cloud edge softness. |
| Reflections | Enables water reflections. |
| Reflection Strength | Controls the contribution of reflections. |
| Ray Quality | Selects screen-space and volumetric sample count. |
| Post-processing | Enables Aurora's additional image pass. |
| Ambient Occlusion | Adds contact shading around nearby geometry. |
| Sharpening | Restores local texture detail. |
| Depth of Field | Enables optional far-distance blur. |
| Moon Rays | Controls night-time volumetric rays. |
| Cloud Shadows | Controls moving cloud shade on terrain. |
| Zoom FOV | Controls the field of view while holding zoom. |

## Controls

| Key | Action |
| --- | --- |
| F8 | Reload shader files. |
| F9 | Cycle presets. |
| F10 | Toggle Allumeria Enhanced. |
| C | Hold to zoom. |

Pack manifests apply only settings explicitly listed in their `settings`
object. Other user settings remain unchanged when switching packs.

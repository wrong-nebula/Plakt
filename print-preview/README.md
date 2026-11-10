# PosterLab print preview

> **Not in the app at the moment.** The 3D print preview was taken out of PosterLab on 10 November 2026, to come back later. This folder keeps the renderer's source. The native side (the **Print preview** button and sheet, `PrintPreviewView`, `PrintPreviewCoordinator`, `PrintPreviewResources`, the bundled `Sources/PosterCore/Resources/PrintPreview`, and the agents' `print_preview` view) is in git up to commit `257b0c2`. `node build.mjs` still writes that resource folder, but nothing loads it now. The rest of this page describes the feature as it was.

An offline Three.js renderer embedded in the native macOS app with `WKWebView`. Open **Print preview** in the main header. It starts with the selected Generate candidate or Review library poster; without a selection it shows explicitly labeled sample artwork. **Choose artwork…** accepts PNG, JPEG, TIFF, HEIC and WebP through a native panel. Choose **Output** in the top toolbar, then **Render PNG…** to save the scene without controls: Viewport, 4K (3840 px), 8K (7680 px), or 12K (12288 px) on the long edge.

The default scene is **Studio**: the sheet hangs on a seamless sweep (white, grey or black backdrop paper with a curved cove into the floor) lit by a gridded key softbox and a large fill bounce. **Key light** sets the key's angle around the sheet, **Softbox** its size (60–200 cm, hard to soft) and **Fill** the bounce as a share of the key. The lights are metered at the sheet's centre, so moving or resizing them changes modelling and shadows but not exposure. Mounting sets the standoff from the sweep: wheatpaste lies flat, tape sits 8 mm out and a loose sheet 35 mm, each with its own shadow. **City display** is the freestanding metal display with twin posts on a white, grey or black gradient. **Outside** and **Inside** retain the contextual scenes. Older saved settings adopt Studio once while preserving print settings.

A separate local build is available at `print-preview/artifacts/PosterLab Print Preview.app`. It uses its own application identifier and preferences, and was not opened or installed over the shared app. The standalone build resolves the core resource bundle from the standard app Resources directory; that packaging adjustment is confined to the temporary build snapshot.

This is the first material-preview implementation. It gives the renderer real geometry, lighting and material response; it is not a calibrated print proof or a finished photoreal production renderer.

## Implemented

- Physical scale in metres. City (900 mm wide), A2, A1 and A0 choose the sheet width; imported artwork keeps its original aspect ratio. The city display clamps the paper inside the housing; paste, tape and curl controls appear in the contextual scenes.
- Uncoated, silk coated, newsprint and cotton-rag stock presets; grammage sets paper thickness from an approximate stock density. Front, back and edge meshes follow the same deformation function.
- A subdivided paper surface with procedural wrinkles, a raised crease, edge lift and corner curl. Paste, masking tape and loose mounting change wall separation and deformation. The paste layer sits behind the sheet, with a visible perimeter and adjustable wetness/roughness.
- Procedural paper fiber and wall textures; concrete, brick and plaster outdoor walls; gallery walls and flooring. There are no downloaded textures or remote model assets.
- Digital printing, four-angle CMYK AM screening for offset, density and plate displacement in millimetres. Riso is an authored approximation using coarse screens, misregistration and nonuniform ink. Screen and grain detail fade below pixel resolution to reduce moiré.
- Metallic spot ink, gold and silver foil, holographic foil and spot varnish. Masks can target dark pixels, chromatic pixels, the full sheet, or an imported grayscale image. White in a custom mask applies the finish. Reflectivity, roughness, metallic response and thin-film iridescence change with light and view direction.
- Solar-time, latitude and seasonal sun position; Three.js's analytic Preetham sky supplies outdoor lighting and a filtered reflection environment. Haze controls atmospheric scattering. Direct-light intensity and twilight transitions are authored approximations. At night the sky darkens and an adjustable wall lamp illuminates the poster.
- A gallery with temperature/intensity controls for area and spot lights, daylight through the room and a separate room reflection environment.
- Orbit/zoom plus front, perspective, edge-detail and context camera presets. Frames render on demand; the renderer does not run an idle animation loop. High/standard pixel resolution, bounded native image textures, explicit GPU disposal and nonpersistent isolated WebKit storage.
- Studio light is physically based throughout. Both softboxes are Three.js rectangle area lights (linearly transformed cosines), so the paper, inks and foils show real soft highlights. The sheet is the only occluder on the set, so the sweep traces its shadows exactly rather than using shadow maps. Each softbox is sampled over its area (8 × 8 jittered rays, only in the penumbra), and ambient light loses the sheet's exact form factor, which gives contact darkening along the edges. The reflection environment is a dim room with the lit sweep floor. Every scene uses Khronos PBR Neutral tone mapping, which keeps artwork hues and paper white; a saturated blue that ACES pushed toward periwinkle now stays close to the file. Each scene has a fixed exposure match (Outside 1.2×, Inside 0.85×) so its brightness stays close to the earlier look, and the Inside lamp keeps 40% of its warm tint, as after a camera's white balance.
- Antialiasing uses a hardware-supported multisampled HDR scene target (up to 4×), followed by SMAA in linear color, then Neutral tone mapping and sRGB output. High quality supersamples at 1.5× device resolution, bounded by a 4-million-pixel budget and GPU texture limits; Standard uses up to device resolution with a 2-million-pixel budget. PNG exports use the same filtered pipeline.
- Artwork, procedural maps and custom masks use explicit trilinear mipmaps and anisotropic filtering up to the hardware limit (capped at 16×). Print plates use explicit texture gradients. Ink grain is sampled from the mip-filtered paper texture; halftone screens fade to mean coverage near their most compressed axis's sampling limit. A normal-variance roughness term reduces specular shimmer on glossy finishes.
- High-resolution stills use overlapping camera tiles with 32-pixel guard bands for antialiasing. Global gradient and dither coordinates keep tile joins consistent. PNG rows stream through a small encoding strip instead of allocating a full-size canvas or RGBA image; even 12K output keeps the GPU targets small. Shadow maps temporarily increase to 4096 px. Progress, cancellation, a frozen preview, and restoration of the camera, controls and preview resolution are included. PNGs declare sRGB. Native artwork decoding preserves up to 8192 px on the long edge.
- Settings persist under a feature-specific preferences key. Imported artwork and mask pixels are session-local. When reopening without the mask image, a saved custom-mask selection returns to the dark-artwork mask.

## Development

```sh
cd print-preview
npm ci
npm run build
npm run check
```

`build.mjs` bundles the pinned Three.js dependency and addons into a Safari-compatible IIFE at `Sources/PosterCore/Resources/PrintPreview/preview.js`, alongside the HTML, CSS and Three.js MIT license. These generated files are included with the feature so normal Swift builds need no Node installation or network access. The existing core resource bundle and app packaging script already include them; no package-manifest or packaging changes are needed.

Rebuild the native app with the normal project build script when ready to use the new feature. During parallel sessions, use a private source snapshot and a separate `--scratch-path`, and leave the running app and `dist/` alone. The implementation was checked that way; this work did not install or relaunch the shared app.

For standalone web development, `npm run dev` serves the generated viewer on `127.0.0.1:4387` (`POSTER_PREVIEW_PORT` overrides the port). The production app uses bundled files directly and needs no server.

After a build, `print-preview/src/index.html` also loads the generated viewer directly, so a local source-entry tab can be refreshed without starting a server.

`node smoke.mjs` starts its own headless Chrome process with an isolated temporary profile. It checks all print-process and finish choices, mounting/stock changes, custom masks, image import, export, immediate-reload preference persistence, compact layouts and retained geometry/texture counts. It also rejects external requests and JavaScript errors. Set `POSTER_CHROME` if Chrome is installed elsewhere. Screenshots and the report go to `output/print-preview/`. The sample real-artwork check uses the existing `output/curated/color-field-user-v13/poster.png` fixture.

`NativeSmoke.swift`, compiled with `PrintPreviewCoordinator.swift`, is a separate nonactivating, offscreen WebKit host. It exercises the actual native artwork bridge with isolated preferences, bundled file loading, shader compilation, native WebKit snapshot, PNG readback and GPU disposal. It does not activate or attach to a running PosterLab instance.

`node filtering-smoke.mjs` checks the filtering pipeline at close range, distance and oblique angles, verifies the artwork stays visible through the depth/MSAA passes, and exercises immediate export, quality changes and the local source entry. Its before/after captures and hardware diagnostics are under `output/print-preview/filtering/`.

`node render-smoke.mjs` renders real 4K and 12K PNGs through the output controls and verifies dimensions, cancellation and restoration of the interactive preview. Output files and timing evidence are under `output/print-preview/high-resolution/`. The native smoke host also renders and validates a 4K PNG through the same engine.

## Integration boundaries

| File | Responsibility |
| --- | --- |
| `Sources/PosterStudio/StudioRootView.swift` | Header action and preview presentation; the only pre-existing Swift file changed for the feature |
| `Sources/PosterStudio/PrintPreviewView.swift` | SwiftUI presentation, isolated WKWebView, cleanup |
| `Sources/PosterStudio/PrintPreviewCoordinator.swift` | Native import/export panels, bounded and oriented image decoding, settings, safe argument-based JavaScript calls, local-only navigation |
| `Sources/PosterCore/PrintPreviewResources.swift` | Public locator for the existing resource bundle |
| `print-preview/src/settings.js` | Validated settings, stock properties, solar position and physical deformation model |
| `print-preview/src/paper-mesh.js` | Front/back/edge meshes and mounting geometry |
| `print-preview/src/print-material.js` | Print and masked finish shader on MeshPhysicalMaterial |
| `print-preview/src/renderer.js` | Scene geometry, lights, sky, environment baking, camera and GPU lifecycle |
| `print-preview/src/studio-scene.js` | Seamless sweep, metered key and fill softboxes, traced sheet shadows and studio reflection environment |
| `print-preview/src/display-scene.js` | Flush metal city display, twin posts, seamless gradient and softbox reflection environment |
| `print-preview/src/filtering.js` | Shared texture sampler policy and bounded supersampling resolution |
| `print-preview/src/high-resolution.js` | Tiled high-resolution rendering, progress/cancellation and preview restoration |
| `print-preview/src/png-writer.js` | Streaming, sRGB-tagged PNG encoding without a full-size canvas |
| `print-preview/src/app.js` | Accessible controls, settings persistence and native JavaScript bridge |

## Limits and next steps

Material presets are plausible authored values, not measurements of specific paper or ink products. Metallic spot colors are RGB approximations; no licensed Pantone library, spectral reflectance data, ICC soft proofing or measured BRDF data is included. Riso does not yet separate a design into actual stencil-master spot-color plates. Paste drying, moisture and deformation are controllable procedural states rather than fluid or cloth simulations. The paper texture is not a scanned fiber model; it combines formation flocs, short fibres with a slight machine direction and surface tooth, all tiling seamlessly. Indoor reflections use a generic room capture; direct lamp controls are not a full architectural light simulation. Outside the studio, shadows are rasterized shadow maps with their usual resolution limits; studio shadows are traced only against the sheet, so tape strips and edge curl cast none. Output reaches 12288 px on the long edge; artwork detail is bounded by the imported image's resolution. Encoded PNG data is capped at 180 MiB.

The next realism work should add scanned stock/wall material sets, explicit artwork separations for real spot inks, measured print/foil material presets, a progressive path-traced still-render mode, and reference photographs for systematic comparison. The current code keeps geometry, materials, lighting and host integration separate to support those steps.

Primary references: [Three.js Sky](https://threejs.org/docs/pages/Sky.html), [MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html), [PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html). The implementation pins Three.js 0.180.0 and uses its local addon/source APIs.

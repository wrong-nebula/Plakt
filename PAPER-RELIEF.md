# Paper-relief compositions

`paper-relief-composition` upgrades the folded-tile vocabulary into an assembly of paper surfaces. The source default follows the Neubad reference's irregular merged grid, central dark void, diagonal flaps, circular openings and small rotated labels. Original vectors and exact physical measurements are unknown; the reconstruction is an authored interpretation.

## Geometry and ownership

A `PaperReliefGenome` records identified surfaces, their source bounds, kind, elevation, hinge, paper tone, content role and label rotation. Five constructions are available:

- **Panel:** elevated paper with shared directional lighting and contact shadows.
- **Flap:** a triangular or rectangular sheet rotated about a declared hinge line in 3D.
- **Recess:** an opening with a floor below the backing plane and visible connecting walls.
- **Hole:** a real circular subtraction through a paper face, showing the layer beneath.
- **Disc:** an elevated circular face.

Projection is shallow orthographic 2.5D. The assembly carries its intrinsic aspect ratio and fits uniformly into inherited image fields; wide fields do not flatten its panels or circular forms. Older genomes without an explicit aspect retain their original field fit for replay. Paper and attached glyph outlines use the same affine plane transform. Surfaces are painted in saved stacking order; a higher surface covers both lower paper and its labels. Soft shadows use layered translucent vector paths, and paper shading uses native linear gradients. Export does not require rasterizing the relief.

Text remains ordinary editable `SceneElement.text`. A `PaperSurfaceAttachment` identifies its parent, surface, local bounds, rotation and content role. The renderer draws that label within its owner's paint pass, clipped to the owner's actual cutout path. It skips the label in the ordinary overlay pass. Replaying a scene preserves edited text; `PaperReliefSystems.resolve(in:)` deliberately rebinds roles when making a new brief or recomposing the assembly.

Preset overrides can supply a surface title and an optional custom array of surfaces. `PaperReliefSystems.validate` rejects missing parents, unknown surface IDs and invalid geometry. Scene genomes retain the full generated surface list and text attachments, rather than only a recipe name.

## Controls

The Shape library exposes the Neubad arrangement, terraces and a seeded collage. Elevation, flap angle, recess depth, aperture size, overlap, paper edge, cast shadow, light direction, label coverage/size/rotation and inherited ink tint are independent controls. The source arrangement keeps its measured scaffold; alternative arrangements use a separate seeded random stream.

The paper specimen is already a complete composition, including its attached text. The generic whole-poster gesture toggle is disabled for it. Font choices and saved titles remain available. In inherited poster layouts, a pinned relief occupies an image field and binds its labels to the current brief.

```sh
poster shape-library render --id paper-relief-composition --text 'COMMON GROUND' --set foldAngle=45,recessDepth=0.05 --out output/my-paper-study
poster shape-library index --id paper-relief-composition --out output/my-paper-index
```

Four construction passes show flat blockout, primary surface type, supporting information and final crease detail. Generation studies use existing compositions and current judges; their ranks do not create user taste votes or alter the parallel SigLIP/segmentation work.

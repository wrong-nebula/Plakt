"""Independent Python/Core ML fixtures for checking the native Swift SAM runtime."""
import base64
import json
import time
from pathlib import Path

import coremltools as ct
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "models/sam2"
OUT = ROOT / "output/sam2-integration-v1"
OUT.mkdir(parents=True, exist_ok=True)
manifest = json.loads((PACK / "manifest.json").read_text())
models = {role: ct.models.MLModel(str(PACK / package), compute_units=ct.ComputeUnit.CPU_ONLY)
          for role, package in manifest["packages"].items()}
cases = [
    ("flower-box", "02f8efca35d0a69f7065e7e8-p0.jpg", [(0.50, 0.575, 2), (0.76, 0.765, 3)]),
    ("ring-points", "02f8efca35d0a69f7065e7e8-p0.jpg", [(0.86, 0.085, 1), (0.87, 0.16, 0)]),
    ("type-box", "d99e3b5e25a28961c75ffef7-p0.jpg", [(0.72, 0.04, 2), (0.99, 0.88, 3)]),
]
fixtures = []
for name, filename, points in cases:
    folder = OUT / name
    folder.mkdir(exist_ok=True)
    image = Image.open(ROOT / "output/siglip-collection-snapshot-v1/posters" / filename).convert("RGB").resize((1024, 1024), Image.Resampling.BICUBIC)
    image.save(folder / "input.png")
    start = time.monotonic()
    features = models["encoder"].predict({"image": image})
    coordinates = np.array([[[p[0]*1024, p[1]*1024] for p in points]], dtype=np.float16)
    labels = np.array([[p[2] for p in points]], dtype=np.float16)
    encoded = models["prompt"].predict({"points": coordinates, "labels": labels})
    output = models["decoder"].predict({**features, "sparse_embedding": encoded["sparse_embeddings"], "dense_embedding": encoded["dense_embeddings"]})
    masks = output["low_res_masks"][0] > 0
    for i, mask in enumerate(masks):
        Image.fromarray(mask.astype(np.uint8)*255).save(folder / f"mask-{i}.png")
    fixture = {"id": name, "imageURL": (folder / "input.png").as_uri(),
               "points": [{"x": p[0], "y": p[1], "label": p[2]} for p in points],
               "masks": [base64.b64encode(m.astype(np.uint8).tobytes()).decode() for m in masks],
               "scores": output["scores"][0].astype(float).tolist(), "seconds": time.monotonic()-start}
    fixtures.append(fixture)
    print(name, fixture["scores"], "area", masks.mean(axis=(1, 2)), "seconds", fixture["seconds"], flush=True)
(OUT / "reference.json").write_text(json.dumps({"fingerprint": manifest["fingerprint"], "fixtures": fixtures}, indent=2)+"\n")
print("Saved", OUT / "reference.json")

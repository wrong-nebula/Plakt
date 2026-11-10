"""Download Apple's pinned SAM 2.1 Tiny Core ML release; never execute remote code."""
import argparse
import hashlib
import json
import ssl
import urllib.request
from pathlib import Path

import certifi
import coremltools as ct

REPOSITORY = "apple/coreml-sam2.1-tiny"
REVISION = "39ae0a8a83e5e6cd196e804bf7cccc5f8171f306"
PACKAGES = {name: f"SAM2_1Tiny{part}FLOAT16.mlpackage" for name, part in
            [("encoder", "ImageEncoder"), ("prompt", "PromptEncoder"), ("decoder", "MaskDecoder")]}


def download(url, target):
    if target.exists():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.name + ".download")
    request = urllib.request.Request(url, headers={"User-Agent": "PosterLab-local-model-setup"})
    with urllib.request.urlopen(request, context=ssl.create_default_context(cafile=certifi.where()), timeout=180) as response, temporary.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    temporary.replace(target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("models/sam2"))
    args = parser.parse_args()
    root = args.out
    root.mkdir(parents=True, exist_ok=True)
    descriptions = {}
    for role, package in PACKAGES.items():
        for file in ["Manifest.json", "Data/com.apple.CoreML/model.mlmodel", "Data/com.apple.CoreML/weights/weight.bin"]:
            relative = package + "/" + file
            download(f"https://huggingface.co/{REPOSITORY}/resolve/{REVISION}/{relative}", root / relative)
        model = ct.models.MLModel(str(root / package), skip_model_load=True)
        spec = model.get_spec()
        descriptions[role] = str(spec.description)
        print(role, descriptions[role], flush=True)
    download(f"https://huggingface.co/{REPOSITORY}/resolve/{REVISION}/README.md", root / "MODEL-CARD.md")
    download("https://raw.githubusercontent.com/facebookresearch/sam2/2b90b9f5ceec907a1c18123530e92e794ad901a4/LICENSE", root / "LICENSE.txt")
    files = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
             for p in sorted(root.rglob("*")) if p.is_file() and p.name not in ["manifest.json", ".DS_Store"]}
    preprocessing = "apple-sam2.1-tiny-fp16-stretch1024-top-left-points-v1"
    identity = preprocessing + "\n" + "".join(f"{name}\t{digest}\n" for name, digest in sorted(files.items()))
    manifest = {"version": 1, "model": REPOSITORY, "revision": REVISION,
                "sourceURL": f"https://huggingface.co/{REPOSITORY}/tree/{REVISION}",
                "fingerprint": hashlib.sha256(identity.encode()).hexdigest(), "files": files,
                "packages": PACKAGES, "inputSize": 1024, "maskSize": 256,
                "preprocessing": preprocessing, "maxPoints": 14, "descriptions": descriptions,
                "note": "Apple's unmodified FP16 release. Predicted mask IoU is a model estimate, not verified segmentation accuracy. The image is stretched; points are normalized top-left coordinates multiplied by 1024. No video memory is used."}
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("Prepared", root, manifest["fingerprint"])


if __name__ == "__main__":
    main()

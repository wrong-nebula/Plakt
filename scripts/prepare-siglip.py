"""Build an offline SigLIP pack and verify FP16 against the original PyTorch model.

Build-time only: .build/siglip-venv/bin/python scripts/prepare-siglip.py
Runtime search uses Swift/Core ML and needs neither Python nor network access.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import coremltools as ct
import numpy as np
import torch
import torch.nn.functional as F
from huggingface_hub import snapshot_download
from PIL import Image
from sentencepiece import sentencepiece_model_pb2
from transformers import AutoModel, AutoTokenizer

ROOT = Path(__file__).resolve().parents[1]
MODEL = "google/siglip-base-patch16-224"


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def file_hash(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


class ImageEncoder(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.vision = model.vision_model

    def forward(self, pixels):
        return F.normalize(self.vision(pixels * 2 - 1).pooler_output, dim=-1)


class TextEncoder(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.text = model.text_model

    def forward(self, ids):
        return F.normalize(self.text(ids).pooler_output, dim=-1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=ROOT / "models/siglip")
    parser.add_argument("--revision", default="7fd15f0689c79d79e38b1c2e2e2370a7bf2761ed", help="Pinned Hugging Face commit")
    parser.add_argument("--offline", action="store_true", help="Use only the existing download cache")
    args = parser.parse_args()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    cache = ROOT / ".build/siglip-cache"
    revision = args.revision
    print(f"Downloading {MODEL}@{revision}", flush=True)
    source = Path(snapshot_download(MODEL, revision=revision, cache_dir=str(cache),
        allow_patterns=["*.json", "*.model", "*.safetensors", "README.md"], local_files_only=args.offline))
    torch.set_num_threads(4)
    torch.manual_seed(71)
    model = AutoModel.from_pretrained(source, attn_implementation="eager").eval()
    tokenizer = AutoTokenizer.from_pretrained(source, use_fast=False)
    proto = sentencepiece_model_pb2.ModelProto.FromString(Path(tokenizer.vocab_file).read_bytes())
    assert proto.trainer_spec.model_type == 1, "Expected SentencePiece Unigram"
    assert proto.normalizer_spec.add_dummy_prefix and proto.normalizer_spec.remove_extra_whitespaces
    assert proto.normalizer_spec.escape_whitespaces
    write_json(out / "tokenizer.json", {
        "pieces": [{"text": p.piece, "score": p.score, "type": p.type} for p in proto.pieces],
        "charsmap": __import__("base64").b64encode(proto.normalizer_spec.precompiled_charsmap).decode(),
        "unknownID": tokenizer.unk_token_id, "eosID": tokenizer.eos_token_id,
        "padID": tokenizer.pad_token_id, "maxTokens": 64,
        "byteFallback": proto.trainer_spec.byte_fallback, "unknownPrefixCount": tokenizer.unk_token_length,
    })
    prompts = ["dense experimental typography", "minimal red and black geometric poster",
        "a poster with a large photograph", "black and white grid typography", "serif lettering and an ornamental rosette",
        "  RED\tAND\nBLACK  ", "café — naïve typography", "ＡＢＣ ① ﬁ", "日本語のポスター", "emoji 🐈🦉",
        "a very long poster brief " * 40, "hello</s>world", "<unk>", "", "\u0001test\u00a0copy"]
    fixtures = []
    for prompt in prompts:
        ids = tokenizer(prompt, padding="max_length", truncation=True, max_length=64)["input_ids"]
        fixtures.append({"text": prompt, "tokens": ids})
    write_json(out / "tokenizer-fixtures.json", fixtures)
    image_encoder, text_encoder = ImageEncoder(model).eval(), TextEncoder(model).eval()
    with torch.no_grad():
        image_trace = torch.jit.trace(image_encoder, torch.rand(1, 3, 224, 224))
        text_trace = torch.jit.trace(text_encoder, torch.tensor([fixtures[0]["tokens"]]))
    configurations = [
        ("image", image_trace, [ct.ImageType(name="image", shape=(1,3,224,224), scale=1/255,
             color_layout=ct.colorlayout.RGB)], "image_embedding"),
        ("text", text_trace, [ct.TensorType(name="input_ids", shape=(1,64), dtype=np.int32)], "text_embedding"),
    ]
    converted = {}
    for name, traced, inputs, output in configurations:
        print(f"Converting {name} encoder to FP16", flush=True)
        ml = ct.convert(traced, inputs=inputs, outputs=[ct.TensorType(name=output)],
            minimum_deployment_target=ct.target.macOS15, compute_precision=ct.precision.FLOAT16,
            compute_units=ct.ComputeUnit.CPU_ONLY)
        ml.author = "Google; converted locally for PosterLab"
        ml.license = "Apache-2.0"
        ml.short_description = f"SigLIP {name} encoder; FP16; normalized 768-dimensional features"
        ml.save(str(out / f"{name}.mlpackage"))
        converted[name] = ml
    print("Checking conversion against PyTorch", flush=True)
    checks = []
    for fixture in fixtures[:10]:
        ids = np.asarray([fixture["tokens"]], dtype=np.int32)
        with torch.no_grad():
            expected = text_encoder(torch.from_numpy(ids).long()).numpy().ravel()
        actual = converted["text"].predict({"input_ids": ids})["text_embedding"].ravel()
        similarity = float(np.dot(expected, actual) / (np.linalg.norm(expected)*np.linalg.norm(actual)))
        assert similarity > 0.999, (fixture["text"], similarity)
        checks.append({"kind": "text", "text": fixture["text"], "cosine": similarity})
        fixture["embedding"] = expected.tolist()
    write_json(out / "tokenizer-fixtures.json", fixtures)
    # Decode a real range of existing source posters as a reproducible conversion sample.
    library = ROOT / "library/library.json"
    images = []
    if library.exists():
        from urllib.parse import urlparse, unquote
        entries = json.loads(library.read_text())["posters"]
        images = [Path(unquote(urlparse(e["imageURL"]).path)) for e in entries[::max(1,len(entries)//8)][:8]]
    if not images:
        generated = out / "verification-pattern.png"
        Image.fromarray(np.random.default_rng(71).integers(0,256,(224,224,3),dtype=np.uint8)).save(generated)
        images = [generated]
    for i, path in enumerate(images):
        image = Image.open(path).convert("RGB").resize((224,224), Image.Resampling.BICUBIC)
        pixels = torch.from_numpy(np.array(image).transpose(2,0,1).copy()).float().unsqueeze(0)/255
        with torch.no_grad():
            expected = image_encoder(pixels).numpy().ravel()
        actual = converted["image"].predict({"image": image})["image_embedding"].ravel()
        similarity = float(np.dot(expected, actual)/(np.linalg.norm(expected)*np.linalg.norm(actual)))
        assert similarity > 0.999, (str(path), similarity)
        checks.append({"kind": "image", "path": str(path), "cosine": similarity})
        image.save(out / f"fixture-image-{i}.png")
        write_json(out / f"fixture-image-{i}.json", expected.tolist())
    hashes = {str(p.relative_to(out)): file_hash(p) for p in sorted(out.rglob("*"))
        if p.is_file() and p.name != ".DS_Store" and (".mlpackage/" in str(p) or p.name == "tokenizer.json")}
    identity = hashlib.sha256("".join(f"{name}\t{hashes[name]}\n" for name in sorted(hashes)).encode()).hexdigest()
    write_json(out / "manifest.json", {"version":1,"model":MODEL,"revision":revision,"fingerprint":identity,
        "dimensions":768,"imageSize":224,"maxTokens":64,"precision":"float16",
        "imageModel":"image.mlpackage","textModel":"text.mlpackage","tokenizer":"tokenizer.json",
        "preprocessing":"upright-sRGB-CG-high-stretch224-minus1plus1-v1","files":hashes})
    write_json(out / "verification.json", {"source":MODEL,"revision":revision,"checks":checks,
        "minimumCosine":min(c["cosine"] for c in checks),"torch":torch.__version__,"coremltools":ct.__version__,
        "note":"Conversion parity uses identical 224px RGB inputs. Native resizing is independently versioned."})
    write_json(out / "provenance.json", {"source":f"https://huggingface.co/{MODEL}/tree/{revision}",
        "license":"Apache-2.0","reference":"https://github.com/john-rocky/CoreML-Models/blob/master/conversion_scripts/convert_siglip.py",
        "changes":"Fixed 64-token EOS padding, original SentencePiece data, FP16, explicit macOS target, parity assertions."})
    (out / "MODEL-CARD.md").write_text((source / "README.md").read_text())
    (out / "LICENSE.txt").write_text((ROOT / "scripts/siglip-LICENSE.txt").read_text())
    print(f"Verified model pack: {out}; minimum cosine {min(c['cosine'] for c in checks):.6f}", flush=True)


if __name__ == "__main__":
    main()

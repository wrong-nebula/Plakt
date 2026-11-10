"""Freeze tested SAM-shape inputs and verify the packaged preview."""
import hashlib
import json
import struct
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlparse


def main():
    root = Path(__file__).resolve().parent.parent
    out = root / "output/sam-shape-expansion-v1"
    snapshot = root / ".build/sam-shape-expansion"

    def sha(path):
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def payload(path):
        data = bytearray(path.read_bytes())
        assert struct.unpack_from("<I", data)[0] == 0xFEEDFACF
        offset, end = 32, None
        for _ in range(struct.unpack_from("<I", data, 16)[0]):
            command, size = struct.unpack_from("<II", data, offset)
            if command == 0x19 and bytes(data[offset+8:offset+24]).rstrip(b"\0") == b"__LINKEDIT":
                struct.pack_into("<Q", data, offset+32, 0)
                struct.pack_into("<Q", data, offset+48, 0)
            if command == 0x1D:
                end = struct.unpack_from("<I", data, offset+8)[0]
                struct.pack_into("<I", data, offset+12, 0)
            offset += size
        assert end is not None
        return hashlib.sha256(data[:end]).hexdigest()

    preview = root / "dist/sam-shapes-preview/PosterLab SAM Shapes.app"
    executables = [snapshot / ".build/release/PosterStudio", preview / "Contents/MacOS/PosterStudio"]
    identity = [dict(path=str(p.relative_to(root)), signedSHA256=sha(p), canonicalPayloadSHA256=payload(p)) for p in executables]
    assert identity[0]["canonicalPayloadSHA256"] == identity[1]["canonicalPayloadSHA256"]
    subprocess.run(["codesign", "--verify", "--deep", "--strict", str(preview)], check=True)
    (out / "preview-binary-identity.json").write_text(json.dumps(dict(
        note="Payload excludes signing bytes and normalizes signature-sized LINKEDIT fields. All other bytes match.",
        binaries=identity), indent=2) + "\n")
    selections = json.loads((out / "source-selections.json").read_text())
    assert len(selections) == 13
    for selection in selections:
        assert sha(Path(unquote(urlparse(selection["imageURL"]).path))) == selection["sourceImageSHA256"]

    baseline = json.loads((out / "catalog-baseline.json").read_text())
    resource = Path("Sources/PosterCore/Resources")
    catalog = json.loads((snapshot / resource / "ShapeLibrary/catalog.json").read_text())
    systems = json.loads((snapshot / resource / "ShapeSystems/catalog.json").read_text())
    assert len(catalog["recipes"]) == 45 and len(systems["systems"]) == 14
    for old, current in zip(baseline["library"]["recipes"], catalog["recipes"]):
        if old["id"] == "circle-clusters":
            old = json.loads(json.dumps(old))
            next(p for p in old["parameters"] if p["id"] == "satellite")["min"] = 0
            old["tags"].append("disc-grid")
            assert current["references"][:-1] == old["references"]
            old["references"] = current["references"]
        assert old == current
    assert baseline["systems"]["systems"] == systems["systems"][:8]
    for name in ["ShapeLibrary/catalog.json", "ShapeSystems/catalog.json", "ShapeLibrary/sam-reviewed-sources.json"]:
        files = [snapshot / resource / name, root / resource / name,
                 preview / "Contents/Resources/PosterLab_PosterCore.bundle/Resources" / name]
        assert len({sha(p) for p in files}) == 1, name
    assert "PASS: all 30 check groups" in (out / "final-full-checks.log").read_text()
    assert "PASS: 14 pure-vector shape systems" in (out / "final-discovery-checks.log").read_text()
    sam_log = (out / "final-sam-checks.log").read_text()
    assert "minimum mask IoU 1.0" in sam_log and "stale-mask rejection" in sam_log
    index = json.loads((out / "shape-index/embeddings.json").read_text())
    assert len(index) == 45 and all(x["vision"]["dimensions"] == 768 for x in index)
    assert not json.loads((out / "browser-qa.json").read_text())["brokenImages"]

    files = [snapshot / "Package.swift", *sorted((snapshot / "Sources").rglob("*"))]
    scripts = [p for pattern in ["*reviewed-sam-shapes.py", "refine-sam-shape-sources.py", "package-sam-shapes-preview.sh", "report-multimodal-regions.py"] for p in root.glob("scripts/" + pattern)]
    report = dict(sourceSnapshot=str(snapshot.relative_to(root)),
        sourceFiles={str(p.relative_to(snapshot)): sha(p) for p in files if p.is_file()},
        tools={str(p.relative_to(root)): sha(p) for p in sorted((out / "tools").iterdir()) if p.is_file()},
        scripts={str(p.relative_to(root)): sha(p) for p in scripts}, packagedPreview=identity[1],
        catalogBaselineSHA256=sha(out / "catalog-baseline.json"), sourceSelectionsSHA256=sha(out / "source-selections.json"),
        verifiedSelections=len(selections), samFingerprint=selections[0]["samFingerprint"],
        siglipFingerprint="ff6a95d07b2ca695d2b9f5ce4bd0dfbe0cbe7bbf577e102b334e22ecb263adb1",
        validationLogs=[p.name for p in out.glob("*checks.log")])
    (out / "build-inputs.json").write_text(json.dumps(report, indent=2) + "\n")
    print("PASS: signed preview payload, catalogs, original recipes, 13 source hashes, 45 embeddings and native logs")


if __name__ == "__main__":
    main()

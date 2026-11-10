"""Audit source-state preservation and saved region evidence without changing the library."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import unquote, urlparse


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library", type=Path, default=Path("library"))
    parser.add_argument("--out", type=Path, default=Path("output/multimodal-study-v1/audit.json"))
    args = parser.parse_args()
    root = args.library.resolve()
    entries = json.loads((root / "library.json").read_text())["posters"]
    failures, checked, regions, proposals = [], 0, 0, 0
    def local(url):
        return Path(unquote(urlparse(url).path))
    for entry in entries:
        before = root / "reviews/region-enrichment" / entry["id"] / "record-before.json"
        analysis = root / "segmentation/posters" / entry["id"] / "analysis.json"
        if not before.exists() or not analysis.exists():
            continue
        old, current, measured = (json.loads(p.read_text()) for p in [before, local(entry["recordURL"]), analysis])
        checked += 1
        protected = set(old) | set(current)
        protected -= {"tags", "regionAnalysis"}
        changed = [key for key in sorted(protected) if old.get(key) != current.get(key)]
        if changed:
            failures.append({"id": entry["id"], "protectedFieldsChanged": changed})
        old_tags = [t for t in old["tags"] if t.get("origin") == "review" or t["state"] in ["confirmed", "rejected"]]
        if any(t not in current["tags"] for t in old_tags):
            failures.append({"id": entry["id"], "issue": "Reviewed tag changed"})
        for tag in current["tags"]:
            if tag.get("origin") == "sam-siglip-vision-v1":
                proposals += 1
                if tag["state"] != "suggested" or tag["confidence"] != 0:
                    failures.append({"id": entry["id"], "issue": "Automatic tag became a trusted label"})
        source_hash = hashlib.sha256(local(current["imageURL"]).read_bytes()).hexdigest()
        if measured["imageHash"] != source_hash:
            failures.append({"id": entry["id"], "issue": "Stale source evidence"})
        for region in measured["regions"]:
            regions += 1
            pixel_hash = hashlib.sha256(local(region["imageURL"]).read_bytes()).hexdigest()
            if pixel_hash != region["imageHash"] or region["sourceImageHash"] != source_hash:
                failures.append({"id": region["id"], "issue": "Region pixel provenance mismatch"})
            if region["samComputeUnits"] != "CPU_ONLY" or region["vision"]["model"] == region["siglip"]["model"]:
                failures.append({"id": region["id"], "issue": "Unverified execution or mixed feature spaces"})
            for name in ["maskURL", "inkMaskURL", "cutoutURL"]:
                if not local(region[name]).is_file():
                    failures.append({"id": region["id"], "missing": name})
    result = {"posterSurfaces": len(entries), "auditedRecords": checked, "auditedRegions": regions,
              "automaticUnconfirmedTags": proposals, "failures": failures,
              "note": "Compares every source record field except the enrichment pointer and suggested-tag list against its pre-enrichment backup. Reviewed tags and every region's source/isolated pixel hashes are checked separately."}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2)+"\n")
    print(json.dumps(result, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

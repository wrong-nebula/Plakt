"""Score semantic search and region-analysis suggestions against technique labels from label-techniques.mjs.

python3 scripts/score-technique-review.py [--dir output/technique-review-v1]

Per technique, among labelled candidates (unsure and unlabelled ones are left out):
- SigLIP precision: share of SigLIP's top hits labelled yes.
- Suggestion precision: share of posters carrying a region-analysis suggestion that are labelled yes.
- Random base rate: share of random posters labelled yes, an estimate of how common the technique is.
- Pooled recall: share of all yes-labelled candidates that SigLIP's top hits contain. Positives outside the pool
  are unknown, so this is an upper bound on true recall.
"""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("--dir", type=Path, default=Path(__file__).resolve().parents[1] / "output/technique-review-v1")
args = parser.parse_args()
pools = json.loads((args.dir / "pools.json").read_text())["pools"]
judgments = json.loads((args.dir / "judgments.json").read_text())["judgments"] if (args.dir / "judgments.json").exists() else {}


def share(values):
    return (sum(values) / len(values), len(values)) if values else (None, 0)


def cell(value):
    rate, count = value
    return f"{'—' if rate is None else f'{rate:.2f}'} ({count})".rjust(10)


rows, totals = [], {"siglip": [], "suggested": [], "random": []}
print(f"{'technique':20} {'labelled':>8} {'SigLIP P':>10} {'suggest P':>10} {'base rate':>10} {'recall≤':>8}")
for pool in pools:
    labels = {poster: entry["label"] for poster, entry in judgments.get(pool["technique"], {}).items() if entry["label"] in ("yes", "no")}
    groups = {"siglip": [], "suggested": [], "random": []}
    positives, found = 0, 0
    for candidate in pool["candidates"]:
        if candidate["posterID"] not in labels:
            continue
        yes = labels[candidate["posterID"]] == "yes"
        sources = candidate["sources"]
        siglip = any(source.startswith("siglip:") for source in sources)
        if siglip: groups["siglip"].append(yes)
        if "sam-suggested" in sources: groups["suggested"].append(yes)
        if "random" in sources: groups["random"].append(yes)
        positives += yes; found += yes and siglip
    for key in totals: totals[key] += groups[key]
    recall = f"{found / positives:.2f}" if positives else "—"
    row = {"technique": pool["technique"], "labelled": len(labels), **{key: share(value) for key, value in groups.items()}, "pooledRecall": recall}
    rows.append(row)
    print(f"{pool['technique']:20} {len(labels):8} {cell(row['siglip'])} {cell(row['suggested'])} {cell(row['random'])} {recall:>8}")
print(f"{'all techniques':20} {sum(r['labelled'] for r in rows):8} {cell(share(totals['siglip']))} {cell(share(totals['suggested']))} {cell(share(totals['random']))}")
(args.dir / "scores.json").write_text(json.dumps({"rows": rows, "totals": {k: share(v) for k, v in totals.items()}}, indent=2) + "\n")

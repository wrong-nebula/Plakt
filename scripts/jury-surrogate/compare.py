"""Compares two source-study runs that differ only in --prefilter.

Consensus is relative within a round, so runs are compared on raw judge scores instead: each
candidate's weighted mean over the round's own judge weights (Borda-free, 0–1 for most judges).
Usage: python compare.py RUN_OFF RUN_ON"""
import glob, json, sys
from statistics import mean


def weighted(scores, weights):
    pairs = [(weights[j], s) for j, s in scores.items() if weights.get(j, 0) > 0 and s == s]
    total = sum(w for w, _ in pairs)
    return sum(w * s for w, s in pairs) / total if total else float("nan")


def summarize(run):
    rows = {}
    for path in sorted(glob.glob(run + "/*/round-*/round.json")):
        d = json.load(open(path))
        w = d["weights"]; res = d["judging"]["results"]
        values = {r["id"]: weighted(r["scores"], w) for r in res}
        fresh = [v for k, v in values.items() if not k.endswith("-c0") or d["round"] == 0]  # c0 is the carried champion
        key = path[len(run) + 1:].replace("/round.json", "")
        rows[key] = dict(all=mean(values.values()), fresh=mean(fresh), winner=values[d["winnerID"]],
                         clones=d.get("rejectedVisualClones", 0))
    return rows


off, on = summarize(sys.argv[1]), summarize(sys.argv[2])
print(f"{'round':28s} {'mean off':>9s} {'mean on':>8s} {'winner off':>11s} {'winner on':>10s}")
for key in sorted(off.keys() & on.keys()):
    a, b = off[key], on[key]
    print(f"{key:28s} {a['fresh']:9.3f} {b['fresh']:8.3f} {a['winner']:11.3f} {b['winner']:10.3f}")
keys = sorted(off.keys() & on.keys())
for field in ("fresh", "winner"):
    better = sum(on[k][field] > off[k][field] for k in keys)
    print(f"{field:7s} off {mean(off[k][field] for k in keys):.3f}  on {mean(on[k][field] for k in keys):.3f}  "
          f"on better in {better}/{len(keys)} rounds")

"""Retrains the ranking surrogate with live rounds judged by today's jury.

Stored rounds (data.jsonl) were judged by older judge and taste-juror versions; live rounds (live.jsonl,
from extract.py --out live.jsonl RUN...) by the current one. Each live-seed-* run is held out in turn and
scored by models trained on: stored only, other live runs only, and stored + live with live groups repeated.
Usage: python retrain.py [--save MIX]   (MIX = repeat count of the configuration to export, e.g. 5)
"""
import json, sys
import numpy as np, lightgbm as lgb

stored = [json.loads(l) for l in open("data.jsonl")]
live = [json.loads(l) for l in open("live.jsonl")]
rows = stored + live
is_live = np.array([False] * len(stored) + [True] * len(live))
names = sorted({k for r in rows for k in r["x"]})
cats = ["style", "font", "version", "direction"]
vocab = {c: {v: i for i, v in enumerate(sorted({r[c] for r in rows}))} for c in cats}
X = np.array([[r["x"].get(k, np.nan) for k in names] + [vocab[c][r[c]] for c in cats] for r in rows], float)
feat_names = names + cats; cat_idx = list(range(len(names), len(feat_names)))
rounds = np.array([r["round"] for r in rows]); runs = np.array([r["study"] for r in rows])
rank = np.array([r["rank"] for r in rows], float); n = np.array([r["n"] for r in rows], float)
rel = np.round(4 * (n - rank) / np.maximum(n - 1, 1)).astype(int)
params = dict(objective="lambdarank", lambdarank_truncation_level=8, verbose=-1, num_leaves=31,
              learning_rate=0.05, min_data_in_leaf=20, feature_fraction=0.8)


def fit(idx, repeat_live=1):
    groups = []
    for rd in dict.fromkeys(rounds[idx]):
        members = idx[rounds[idx] == rd]
        groups += [members] * (repeat_live if is_live[members[0]] else 1)
    order = np.concatenate(groups)
    return lgb.train(params, lgb.Dataset(X[order], rel[order], group=[len(g) for g in groups], categorical_feature=cat_idx), 300)


def evaluate(model, idx):
    s = model.predict(X[idx]); rho, top1, keep = [], [], []
    for rd in dict.fromkeys(rounds[idx]):
        m = rounds[idx] == rd; sc, tr = s[m], rank[idx][m]
        pred = (-sc).argsort().argsort() + 1
        k = len(tr); rho.append(1 - 6 * ((pred - tr) ** 2).sum() / (k * (k * k - 1)))
        order = np.argsort(-sc); best = int(np.argmin(tr))
        top1.append(order[0] == best); keep.append(best in order[: k // 2])
    return np.mean(rho), np.mean(top1), np.mean(keep), len(rho)


seeds = sorted({r for r in runs[is_live] if r.startswith("live-seed-")})
configs = {"stored only": (lambda tr: tr[~is_live[tr]], 1), "live only": (lambda tr: tr[is_live[tr]], 1),
           "stored + live": (lambda tr: tr, 1), "stored + live x5": (lambda tr: tr, 5), "stored + live x20": (lambda tr: tr, 20)}
results = {c: [] for c in configs}
for held in seeds:
    test = np.where(runs == held)[0]; train = np.where(runs != held)[0]
    for c, (pick, repeat) in configs.items():
        results[c].append(evaluate(fit(pick(train), repeat), test))
print(f"held-out live seeds: {seeds}")
for c, rs in results.items():
    rs = np.array(rs)
    print(f"  {c:18s} spearman {rs[:, 0].mean():+.2f}  top pick = winner {rs[:, 1].mean():.2f}  "
          f"winner in top half {rs[:, 2].mean():.2f}  ({int(rs[:, 3].sum())} rounds)")

if "--save" in sys.argv:
    repeat = int(sys.argv[sys.argv.index("--save") + 1])
    model = fit(np.arange(len(rows)), repeat)
    model.save_model("surrogate-rank.txt")
    json.dump({"features": feat_names, "categorical": cats, "vocab": vocab}, open("surrogate-rank.schema.json", "w"), indent=1)
    print(f"saved stored + live x{repeat} on {len(rows)} candidates")

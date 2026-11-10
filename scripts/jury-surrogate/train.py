"""Trains and evaluates pre-render jury surrogates on data.jsonl.

A: LightGBM LambdaRank on the stored round ranking.
B: one LightGBM regressor per judge on within-round score percentiles, recombined with
   the round's own weights through the same Borda rule as Candidate.rank.
Folds hold out whole studies, so scores show transfer to a study the model never saw.
"""
import json, sys
from collections import defaultdict
import numpy as np, lightgbm as lgb
from scipy.stats import spearmanr
from sklearn.model_selection import GroupKFold

rows = [json.loads(l) for l in open("data.jsonl")]
names = sorted({k for r in rows for k in r["x"]})
cats = ["style", "font", "version", "direction"]
vocab = {c: {v: i for i, v in enumerate(sorted({r[c] for r in rows}))} for c in cats}
X = np.array([[r["x"].get(k, np.nan) for k in names] + [vocab[c][r[c]] for c in cats] for r in rows], float)
feat_names = names + cats
cat_idx = list(range(len(names), len(feat_names)))
rounds = np.array([r["round"] for r in rows]); studies = np.array([r["study"] for r in rows])
rank = np.array([r["rank"] for r in rows], float); n = np.array([r["n"] for r in rows], float)
rel = np.round(4 * (n - rank) / np.maximum(n - 1, 1)).astype(int)  # 0..4 within round

judges = sorted({k for r in rows for k in r["scores"]})
by_round = defaultdict(list)
for i, r in enumerate(rows):
    by_round[r["round"]].append(i)


def percentile(j):
    """Within-round percentile of judge j's score; NaN where the judge was absent or flat."""
    y = np.full(len(rows), np.nan)
    for idx in by_round.values():
        v = np.array([rows[i]["scores"].get(j, np.nan) for i in idx], float)
        if np.isnan(v).any() or v.max() - v.min() < 1e-9:
            continue
        order = v.argsort().argsort()
        y[idx] = order / (len(idx) - 1)
    return y


def borda(pred_by_judge, idx):
    """Candidate.rank's ballot rule applied to predicted judge scores for one round."""
    w = rows[idx[0]]["weights"]
    total = np.zeros(len(idx)); wsum = 0
    for j, p in pred_by_judge.items():
        weight = w.get(j, 0) if w else 1
        if weight <= 0 or not all(j in rows[i]["scores"] for i in idx):
            continue
        v = p[idx]
        worse = (v[None, :] < v[:, None]).sum(1); eq = (v[None, :] == v[:, None]).sum(1)
        total += weight * (worse + (eq - 1) / 2) / (len(idx) - 1); wsum += weight
    return total / wsum if wsum else total


def evaluate(score, test):
    rho, top1, keep_half, rand_half = [], [], [], []
    for rd in set(rounds[test]):
        idx = by_round[rd]
        if len(idx) < 3:
            continue
        s, true = score[idx], rank[idx]
        rho.append(spearmanr(-s, true).correlation)
        best = int(np.argmin(true)); order = np.argsort(-s)
        top1.append(order[0] == best)
        k = int(np.ceil(len(idx) / 2)); keep_half.append(best in order[:k]); rand_half.append(k / len(idx))
    return dict(rounds=len(rho), spearman=np.nanmean(rho), top1=np.mean(top1), winner_in_top_half=np.mean(keep_half),
                random_top_half=np.mean(rand_half))


params = dict(verbose=-1, num_leaves=31, learning_rate=0.05, min_data_in_leaf=20, feature_fraction=0.8)
folds = list(GroupKFold(n_splits=5).split(X, groups=studies))
pa, pb = np.zeros(len(rows)), np.zeros(len(rows))
judge_y = {j: percentile(j) for j in judges}
judge_r2 = defaultdict(list)
for k, (tr, te) in enumerate(folds):
    tr_sorted = tr[np.argsort(rounds[tr], kind="stable")]
    _, group = np.unique(rounds[tr_sorted], return_counts=True)
    order = np.unique(rounds[tr_sorted], return_index=True)[1]
    group = np.diff(np.append(np.sort(order), len(tr_sorted)))
    ds = lgb.Dataset(X[tr_sorted], rel[tr_sorted], group=group, categorical_feature=cat_idx, free_raw_data=False)
    m = lgb.train({**params, "objective": "lambdarank", "lambdarank_truncation_level": 8}, ds, 300)
    pa[te] = m.predict(X[te])

    preds = {}
    for j, y in (judge_y.items() if "--judges" in sys.argv else []):
        ok = tr[~np.isnan(y[tr])]
        if len(ok) < 200:
            continue
        mj = lgb.train({**params, "objective": "regression"}, lgb.Dataset(X[ok], y[ok], categorical_feature=cat_idx), 200)
        preds[j] = np.zeros(len(rows)); preds[j][te] = mj.predict(X[te])
        t = te[~np.isnan(y[te])]
        if len(t) > 50:
            judge_r2[j].append(spearmanr(preds[j][t], y[t]).correlation)
    for rd in set(rounds[te]):
        idx = by_round[rd]
        pb[idx] = borda(preds, idx)
    print(f"fold {k}: held-out studies {sorted(set(studies[te]))[:6]}...", file=sys.stderr)

allidx = np.arange(len(rows))
print("A lambdarank        ", evaluate(pa, allidx))
if "--judges" in sys.argv:
    print("B per-judge + Borda ", evaluate(pb, allidx))

print("\nA by study family (held-out):")
family = np.array([s.split("-v")[0].rsplit("-", 1)[0] if s.startswith(("source-study", "image-study")) else s.split("-v")[0] for s in studies])
for fam in sorted(set(family), key=lambda f: -(family == f).sum()):
    e = evaluate(pa, np.where(family == fam)[0])
    if e["rounds"] >= 10:
        print(f"  {fam:32s} rounds={e['rounds']:4d} spearman={e['spearman']:+.2f} top1={e['top1']:.2f} "
              f"winner_in_top_half={e['winner_in_top_half']:.2f} (random {e['random_top_half']:.2f})")

# Final model on every round, for use as a pre-render filter.
srt = np.argsort(rounds, kind="stable")
starts = np.sort(np.unique(rounds[srt], return_index=True)[1])
full = lgb.train({**params, "objective": "lambdarank", "lambdarank_truncation_level": 8},
                 lgb.Dataset(X[srt], rel[srt], group=np.diff(np.append(starts, len(srt))), categorical_feature=cat_idx), 300)
full.save_model("surrogate-rank.txt")
json.dump({"features": feat_names, "categorical": cats, "vocab": vocab}, open("surrogate-rank.schema.json", "w"), indent=1)
gain = full.feature_importance("gain")
print("\ntop features by gain:")
for i in np.argsort(-gain)[:15]:
    print(f"  {gain[i] / gain.sum():.3f}  {feat_names[i]}")
print("\nper-judge held-out Spearman (within-round percentile):")
for j, v in sorted(judge_r2.items(), key=lambda kv: -np.nanmean(kv[1])):
    print(f"  {np.nanmean(v):+.2f}  {j}")

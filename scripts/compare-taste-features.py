"""Compare taste-jury feature sets on the personal yes/no votes with repeated grouped cross-validation.

Embed the taste assets first with scripts/siglip-embed-images.swift (one image path per line, taken from taste.json).
python3 scripts/compare-taste-features.py taste/taste.json SIGLIP_EMBEDDINGS.json OUT.json

Layout groups are held out together, features are standardized inside each training fold, and the classifier is
class-balanced L2 logistic regression. With few votes, read the paired bootstrap interval before the point estimates.
"""
import base64
import json
import sys
from urllib.parse import unquote, urlparse

import numpy as np

archive, siglip_path, out = sys.argv[1:4]
archive = json.load(open(archive))
siglip = json.load(open(siglip_path))
assets = archive["assets"]
profile = max(archive["profiles"], key=lambda p: len(p["votes"]))

vision = np.array([np.frombuffer(base64.b64decode(a["embedding"]["data"]), dtype="<f4") for a in assets], dtype=np.float64)
semantic = np.array([siglip[unquote(urlparse(a["imageURL"]).path)] for a in assets], dtype=np.float64)
hashed = np.array([a["features"] for a in assets], dtype=np.float64)


def pca(matrix, k):
    centered = matrix - matrix.mean(0)
    _, _, vt = np.linalg.svd(centered, full_matrices=False)
    return centered @ vt[:k].T


# Projections are fitted on all unlabelled assets; labels never enter them.
voted = [i for i, a in enumerate(assets) if a["id"] in profile["votes"]]
y = np.array([1.0 if profile["votes"][assets[i]["id"]]["yes"] else 0.0 for i in voted])
groups = np.array([assets[i]["groupID"] for i in voted])


def fit(x, y, penalty):
    """Class-balanced L2 logistic regression by Newton iterations; the intercept is not penalized."""
    weight = np.where(y == 1, 0.5 / y.mean(), 0.5 / (1 - y.mean()))
    design = np.hstack([x, np.ones((len(x), 1))])
    beta = np.zeros(design.shape[1])
    ridge = penalty * np.eye(design.shape[1]); ridge[-1, -1] = 0
    for _ in range(50):
        p = 1 / (1 + np.exp(-np.clip(design @ beta, -30, 30)))
        gradient = design.T @ (weight * (p - y)) + ridge @ beta
        hessian = design.T @ (design * (weight * p * (1 - p))[:, None]) + ridge + 1e-9 * np.eye(len(beta))
        step = np.linalg.solve(hessian, gradient)
        beta -= step
        if np.abs(step).max() < 1e-8:
            break
    return beta


def auc(score, y):
    order = np.argsort(score); ranks = np.empty(len(score)); ranks[order] = np.arange(1, len(score) + 1)
    for value in np.unique(score):  # average ranks for ties
        tied = score == value; ranks[tied] = ranks[tied].mean()
    positives = y == 1
    return (ranks[positives].sum() - positives.sum() * (positives.sum() + 1) / 2) / (positives.sum() * (~positives).sum())


def average_precision(score, y):
    order = np.argsort(-score); hits = y[order]
    return float((np.cumsum(hits) / np.arange(1, len(hits) + 1))[hits == 1].mean())


def evaluate(features, penalty, repeats=50, folds=5):
    x = features[voted]
    unique = np.unique(groups)
    results = []
    for repeat in range(repeats):
        rng = np.random.default_rng(repeat)
        assignment = dict(zip(rng.permutation(unique), np.arange(len(unique)) % folds))
        fold = np.array([assignment[g] for g in groups])
        score = np.zeros(len(y))
        for k in range(folds):
            train, test = fold != k, fold == k
            if y[train].min() == y[train].max():
                score[test] = 0.5; continue
            mean, std = x[train].mean(0), x[train].std(0) + 1e-9
            beta = fit((x[train] - mean) / std, y[train], penalty)
            score[test] = (np.hstack([(x[test] - mean) / std, np.ones((test.sum(), 1))]) @ beta)
        predicted = score > 0
        balanced = 0.5 * (predicted[y == 1].mean() + (~predicted[y == 0]).mean())
        results.append((auc(score, y), average_precision(score, y), balanced))
    values = np.array(results)
    return {"auc": values[:, 0].mean(), "aucSD": values[:, 0].std(), "ap": values[:, 1].mean(), "balancedAccuracy": values[:, 2].mean()}



def oof(features, penalty, repeat, folds=5):
    x = features[voted]; unique = np.unique(groups)
    rng = np.random.default_rng(repeat)
    assignment = dict(zip(rng.permutation(unique), np.arange(len(unique)) % folds))
    fold = np.array([assignment[g] for g in groups]); score = np.zeros(len(y))
    for k in range(folds):
        train, test = fold != k, fold == k
        mean, std = x[train].mean(0), x[train].std(0) + 1e-9
        beta = fit((x[train] - mean) / std, y[train], penalty)
        score[test] = np.hstack([(x[test] - mean) / std, np.ones((test.sum(), 1))]) @ beta
    return score

grid = {"current: Vision hashed to 64": hashed}
for k in (16, 32, 64, 128):
    grid[f"Vision, PCA {k}"] = pca(vision, k); grid[f"SigLIP, PCA {k}"] = pca(semantic, k)
report = {"votes": len(y), "yes": int(y.sum()), "groups": len(np.unique(groups)), "results": {}}
print(f"{'features':28} " + " ".join(f"{'pen '+str(p):>12}" for p in (0.1, 1, 3)))
for name, features in grid.items():
    row = []
    for penalty in (0.1, 1, 3):
        r = evaluate(features, penalty, repeats=30); row.append(r); report["results"].setdefault(name, {})[str(penalty)] = r
    print(f"{name:28} " + " ".join(f"{r['auc']:.3f}/{r['ap']:.2f}" .rjust(12) for r in row))

# Paired bootstrap over layout groups: same folds for both, AUC difference SigLIP PCA 64 minus current, penalty 1.
a = np.mean([oof(grid["SigLIP, PCA 64"], 1, r) for r in range(30)], axis=0)
b = np.mean([oof(hashed, 1, r) for r in range(30)], axis=0)
unique = np.unique(groups); rng = np.random.default_rng(7); diffs = []
for _ in range(2000):
    chosen = rng.choice(unique, len(unique)); index = np.concatenate([np.where(groups == g)[0] for g in chosen])
    if y[index].min() == y[index].max(): continue
    diffs.append(auc(a[index], y[index]) - auc(b[index], y[index]))
diffs = np.array(diffs)
summary = {"aucSigLIP64": auc(a, y), "aucCurrent": auc(b, y), "difference": float(np.median(diffs)),
           "ci95": [float(np.percentile(diffs, 2.5)), float(np.percentile(diffs, 97.5))], "shareSigLIPBetter": float((diffs > 0).mean())}
report["pairedBootstrap"] = summary
print("paired group bootstrap (averaged out-of-fold scores):", {k: (round(v, 3) if isinstance(v, float) else [round(x, 3) for x in v]) for k, v in summary.items()})
json.dump(report, open(out, "w"), indent=2)

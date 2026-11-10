"""Exports surrogate-rank.txt as the compact JSON tree file JurySurrogate.swift reads.
Usage: python export.py VERSION   (e.g. jury-surrogate-lambdarank-v2)"""
import json, sys
from pathlib import Path
import lightgbm as lgb

here = Path(__file__).parent
booster = lgb.Booster(model_file=str(here / "surrogate-rank.txt"))
schema = json.load(open(here / "surrogate-rank.schema.json"))


def node(n):
    if "leaf_value" in n:
        return {"v": n["leaf_value"]}
    out = {"f": n["split_feature"], "l": node(n["left_child"]), "r": node(n["right_child"]),
           "dl": n["default_left"], "m": n["missing_type"]}
    if n["decision_type"] == "==":
        out["c"] = [int(x) for x in str(n["threshold"]).split("||")]
    else:
        out["t"] = n["threshold"]
    return out


trees = [node(t["tree_structure"]) for t in booster.dump_model()["tree_info"]]
target = here.parents[1] / "Sources/PosterCore/Resources/JurySurrogate.json"
json.dump({"version": sys.argv[1], "features": schema["features"], "vocab": schema["vocab"],
           "categorical": schema["categorical"], "trees": trees}, open(target, "w"), separators=(",", ":"))
print(f"{len(trees)} trees → {target}")

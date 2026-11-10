"""Scores every candidate genome in the given round.json files with the Python model, for comparing
against `poster library surrogate-score`. Usage: python parity.py ROUND.json ... > python-scores.jsonl"""
import json, sys
from pathlib import Path
import numpy as np, lightgbm as lgb

here = Path(__file__).parent
source = (here / "extract.py").read_text().replace("\nmain()\n", "\n")  # import features() without running main
extract = {"__file__": str(here / "extract.py")}; exec(compile(source, "extract.py", "exec"), extract)
schema = json.load(open(here / "surrogate-rank.schema.json"))
booster = lgb.Booster(model_file=str(here / "surrogate-rank.txt"))
for path in sys.argv[1:]:
    d = json.load(open(path))
    for c in d.get("candidates", []):
        g = c.get("genome") or {}
        if not g.get("elements"):
            continue
        x = extract["features"](g)
        labels = dict(style=g.get("styleCategory") or "", font=g.get("font") or "", version=g.get("version") or "",
                      direction=d.get("direction") or "")
        row = [float(schema["vocab"][k].get(labels[k], -1)) if k in schema["categorical"] else x.get(k, np.nan)
               for k in schema["features"]]
        print(json.dumps(dict(round=path, id=c["id"], score=float(booster.predict(np.array([row]))[0]))))

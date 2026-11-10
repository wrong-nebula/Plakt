"""Builds a pre-render feature table from every stored round.json.

Each row is one judged candidate: features come only from its genome (known before
rendering); targets are the stored per-judge scores, rank and the round's weights.
Usage: python extract.py [--out FILE] [ROOT...]   (default: data.jsonl from output/ and workspaces/)
"""
import glob, json, math, sys, colorsys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
args = sys.argv[1:]
out_path = Path(__file__).with_name("data.jsonl")
if args[:1] == ["--out"]:
    out_path, args = Path(args[1]), args[2:]
roots = args or [str(ROOT / "output"), str(ROOT / "workspaces")]


def rgb(hex_):
    try:
        h = hex_.lstrip("#")[:6]
        return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    except Exception:
        return None


def lum(c):
    f = lambda v: v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def stats(prefix, xs, out):
    if not xs:
        xs = [0.0]
    n = len(xs); m = sum(xs) / n
    out[prefix + "_mean"] = m
    out[prefix + "_max"] = max(xs)
    out[prefix + "_min"] = min(xs)
    out[prefix + "_std"] = math.sqrt(sum((x - m) ** 2 for x in xs) / n)


def features(g):
    f = {}
    f["aspect"] = g.get("aspect", 1.414)
    f["textScale"] = g.get("textScale", 1)
    f["tracking"] = g.get("tracking", 0)
    f["layoutVariant"] = g.get("layoutVariant", -1) if isinstance(g.get("layoutVariant"), (int, float)) else -1
    f["n_typeSystems"] = len(g.get("typeSystemIDs") or [])
    bg = rgb(g.get("background", "#ffffff")) or (1, 1, 1)
    h, l, s = colorsys.rgb_to_hls(*bg)
    f.update(bg_h=h, bg_l=l, bg_s=s, bg_lum=lum(bg))
    comp = g.get("composition") or {}
    f["whitespace_est"] = comp.get("estimatedWhitespace", -1)
    f["n_regions"] = len(comp.get("regions") or [])
    f["n_constraints"] = len(comp.get("constraints") or [])
    f["n_hierarchy"] = len(comp.get("hierarchy") or [])
    m = (comp.get("grid") or {}).get("margins") or {}
    for k in ("top", "bottom", "left", "right"):
        f["margin_" + k] = m.get(k, -1)
    f["gutter"] = (comp.get("grid") or {}).get("gutter", -1)

    els = g.get("elements") or []
    f["n_elements"] = len(els)
    kinds = {}
    areas, text_h, text_area, xs, ys, rots, contrasts, sats = [], [], [], [], [], [], [], []
    colors = set(); bleed = outline = shadow = copies = 0
    for e in els:
        k = e.get("kind", "?"); kinds[k] = kinds.get(k, 0) + 1
        b = e.get("bounds") or {}
        w, hh = b.get("width", 0), b.get("height", 0)
        a = w * hh * max(1, e.get("copies", 1))
        areas.append(a)
        xs.append(b.get("x", 0) + w / 2); ys.append(b.get("y", 0) + hh / 2)
        rots.append(abs(e.get("rotation", 0)) % 180)
        c = rgb(e.get("color", "#000000"))
        if c:
            colors.add(e.get("color", "").lower()[:7])
            contrasts.append(contrast(c, bg)); sats.append(colorsys.rgb_to_hls(*c)[2])
        if k == "text":
            text_h.append(hh); text_area.append(w * hh)
        bleed += bool(e.get("allowsBleed")); outline += bool(e.get("outline"))
        shadow += bool(e.get("shadow")); copies += e.get("copies", 1) > 1
    for k in ("text", "shape", "image", "path", "line"):
        f["n_" + k] = kinds.get(k, 0)
    f["n_kind_other"] = len(els) - sum(kinds.get(k, 0) for k in ("text", "shape", "image", "path", "line"))
    f["coverage_sum"] = sum(areas)
    stats("area", areas, f); stats("text_h", text_h, f); stats("cx", xs, f); stats("cy", ys, f)
    stats("rot", rots, f); stats("contrast", contrasts, f); stats("sat", sats, f)
    f["text_area_sum"] = sum(text_area)
    f["title_ratio"] = (max(text_h) / (sorted(text_h)[len(text_h) // 2] or 1e-3)) if text_h else 0
    f["n_colors"] = len(colors)
    f.update(n_bleed=bleed, n_outline=outline, n_shadow=shadow, n_copies=copies)
    f["n_fonts"] = len({e.get("fontName") for e in els if e.get("kind") == "text"})
    return f


def main():
    files = sorted({p for r in roots for p in glob.glob(r + "/**/round.json", recursive=True)})
    out = open(out_path, "w")
    kept = 0
    for path in files:
        try:
            d = json.load(open(path))
        except Exception:
            continue
        genomes = {c.get("id"): c.get("genome") for c in d.get("candidates", [])}
        results = (d.get("judging") or {}).get("results") or []
        if len(results) < 3:
            continue
        try:
            rel = str(Path(path).relative_to(ROOT)); study = rel.split("/")[1]
        except ValueError:  # live runs outside the project: <run>/<direction>/round-N/round.json
            rel = path; study = Path(path).parts[-4]
        for r in results:
            g = genomes.get(r.get("id")) or {}
            if not g.get("elements"):
                continue  # image studies keep only placeholder genomes
            row = dict(round=rel, study=study, direction=d.get("direction") or "", id=r["id"],
                       rank=r.get("rank"), consensus=r.get("consensus"), scores=r.get("scores") or {},
                       weights=d.get("weights") or {}, n=len(results),
                       style=g.get("styleCategory") or "", font=g.get("font") or "",
                       version=g.get("version") or "", x=features(g))
            out.write(json.dumps(row) + "\n"); kept += 1
    print(f"{kept} candidates from {len(files)} rounds", file=sys.stderr)


main()

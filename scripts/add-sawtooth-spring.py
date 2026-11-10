"""Add (or replace) the sawtooth-and-spring survey recipe in SurveyRecipes.json. Idempotent.
Usage: python3 -I scripts/add-sawtooth-spring.py [project-root]   (defaults to this workspace)"""
from pathlib import Path
import json, sys
root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
path = root / 'Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json'
recipes = [r for r in json.loads(path.read_text()) if r['id'] != 'survey-sawtooth-spring']
def p(id, label, v, lo, hi, step=.001, when=None, within=None):
    d = dict(id=id, label=label, value=v, min=lo, max=hi, step=step)
    if when: d['activeWhen'] = when
    if within: d['activeIn'] = within
    return d
bands, runs = {'layout': [0, 3, 4]}, {'layout': [0, 1, 2, 5]}
parameters = [
    p('layout', 'Spring / stripes / fins / ring / spiral / waveform', 0, 0, 5, 1),
    p('wave', 'Zigzag / sawtooth / square / sine / coil / pulse / stairs / bounce / noise', 0, 0, 8, 1),
    p('skew', 'Zigzag lean, toward a sawtooth', 0, -1, 1, within={'wave': [0]}),
    p('angle', 'Run direction (degrees from vertical)', 0, -90, 90, 0.1),
    p('teeth', 'Turns', 9, 1, 40, 1),
    p('amplitude', 'Swing', 0.92, 0.1, 1.2),
    p('compression', 'Compression toward the end (negative: the start)', 0.65, -1, 1, within={'layout': [0, 1, 2, 4, 5]}),
    p('swell', 'Swing grows along the run', 0, -1, 1),
    p('phase', 'Phase', 0, -0.25, 0.25),
    p('weight', 'Band weight', 0.035, 0.004, 0.2, within=bands),
    p('taper', 'Band tapers along the run', 0, -1, 1, within=bands),
    p('dash', 'Dashed band', 0, 0, 1, within=bands),
    p('copies', 'Bands, stripes, rows or rings', 1, 1, 16, 1),
    p('fill', 'Stripe depth (ring: 1 is a solid blade)', 1, 0.1, 1, within={'layout': [1, 3]}),
    p('depth', 'Rows recede', 0, -1, 1, within={'layout': [1, 2, 5]}),
    p('bend', 'Run bends into an arc', 0, -1, 1, within=runs),
    p('radius', 'Ring or spiral size', 0.62, 0.1, 0.95, within={'layout': [3, 4]}),
    p('coils', 'Spiral coils', 3, 1, 8, 0.5, within={'layout': [4]}),
    p('stagger', 'Row stagger', 0.5, 0, 1, when={'layout': 2}),
    p('corner', 'Rounded corners', 0, 0, 1),
    p('cap', 'End: cut / round / arrow / snake', 0, 0, 3, 1, within={'layout': [0, 4]}),
    p('inkMode', 'One ink / by band / by turn / blended along', 0, 0, 3, 1),
    p('fold', 'Folded faces', 0, 0, 1),
    p('shade', 'Face shading', 0, 0, 1),
    p('shadeStyle', 'Shading: smooth / halftone / hatch', 0, 0, 2, 1),
    p('outline', 'Outlined', 0, 0, 1, 1),
    p('jitter', 'Hand-drawn wobble', 0, 0, 1),
    p('grid', 'Graph paper', 0, 0, 1),
    p('glow', 'Neon glow', 0, 0, 1),
    p('extrude', 'Extruded depth', 0, 0, 1),
    p('misregister', 'Second ink out of register', 0, 0, 1),
    p('glitch', 'Glitch slices', 0, 0, 1),
    p('bandCopy', 'Title along the band', 0, 0, 1, 1, within=bands),
]
def look(name, inks, paper=None, **values):
    known = {x['id'] for x in parameters}
    assert set(values) <= known, set(values) - known
    d = dict(name=name, parameters=values, inks=inks)
    if paper: d['paper'] = paper
    return d
looks = [
    look('Compressed spring', ['#121212', '#8f8f8f']),
    look('Snake', ['#f6f4ee'], paper='#2c3fd0', angle=76, teeth=4, amplitude=0.8, weight=0.06, corner=0.35, cap=3, compression=0),
    look('Chevron stripes', ['#f2b8c6', '#f3d23c', '#141414', '#a59a55', '#f4efe4'], layout=1, angle=90, teeth=7, copies=9, amplitude=0.9, compression=0, inkMode=1),
    look('Shark fins', ['#ff2a1f'], paper='#0b0b0b', layout=2, wave=1, angle=70, teeth=8, copies=7, amplitude=1.1, compression=0, shade=1, stagger=0.5),
    look('Graph-paper zigzag', ['#1a1a1a'], angle=0, teeth=8, compression=0, amplitude=0.8, weight=0.06, outline=1, grid=1),
    look('Chevron arrows', ['#111111'], layout=1, angle=90, teeth=1, copies=4, fill=0.5, amplitude=1.2, compression=0),
    look('Neon coil', ['#ff2bd6'], paper='#0b0c10', wave=4, angle=90, teeth=10, amplitude=0.6, weight=0.02, glow=1, compression=0.4, cap=1),
    look('Acid sawtooth', ['#c6ff00', '#0b0c10'], paper='#0b0c10', layout=1, wave=1, angle=90, teeth=12, copies=10, compression=0.5, inkMode=1),
    look('Accordion fold', ['#ff6a00'], teeth=6, amplitude=0.8, weight=0.12, fold=1, compression=0.3),
    look('Square meander', ['#1d3bff', '#f4f1ea'], layout=1, wave=2, angle=90, teeth=8, copies=8, compression=0, inkMode=1),
    look('Sine ribbons', ['#ff3b30', '#2b2bff'], layout=1, wave=3, angle=90, teeth=3, copies=6, fill=0.6, inkMode=3, swell=0.5, compression=0),
    look('Lightning', ['#ffe100'], paper='#121212', angle=20, teeth=5, jitter=0.8, weight=0.06, amplitude=0.6, cap=2, glow=0.5, compression=-0.4),
    look('Telephone cord', ['#111111'], wave=4, teeth=14, weight=0.012, amplitude=0.35, compression=0.8, swell=0.6, cap=1),
    look('Twin springs', ['#00e5ff', '#ff2bd6', '#c6ff00'], paper='#0b0c10', copies=3, inkMode=1, glow=0.6, weight=0.018, compression=0.7, cap=1),
    look('Sawblade', ['#c9ccd2', '#1b1d22'], paper='#0b0c10', layout=3, skew=0.9, teeth=18, radius=0.7, amplitude=0.7, fill=1, shade=0.6, fold=0.5, extrude=0.7),
    look('Sunburst', ['#ffcc00'], paper='#ff5a1f', layout=3, teeth=24, radius=0.75, amplitude=0.55, fill=1, fold=1),
    look('Heartbeat', ['#39ff88'], paper='#0b0c10', wave=5, angle=90, teeth=4, amplitude=0.9, weight=0.018, compression=0, glow=1),
    look('Audio waveform', ['#ff2bd6'], paper='#0b0c10', layout=5, wave=8, angle=90, teeth=40, amplitude=1.1, compression=0, glow=0.5),
    look('Spiral saw', ['#111111'], layout=4, coils=4, teeth=40, radius=0.85, weight=0.012, amplitude=0.8),
    look('Riso stairs', ['#ff4fa3', '#1d3bff'], layout=1, wave=6, angle=90, teeth=6, copies=7, fill=0.55, misregister=1, compression=0),
    look('Glitch zigzag', ['#00e5ff', '#ff2bd6'], paper='#0b0c10', angle=90, teeth=7, weight=0.05, glitch=1, misregister=0.6, compression=0.3),
    look('Extruded bolt', ['#ffe100'], paper='#141414', angle=15, teeth=4, jitter=0.5, weight=0.08, extrude=1, cap=2, compression=-0.3, amplitude=0.6),
    look('Bent chevrons', ['#ff3b30', '#111111', '#f4efe4'], layout=1, angle=90, teeth=6, copies=8, bend=0.7, compression=0, inkMode=1),
    look('Halftone fins', ['#ff2a1f'], paper='#0b0b0b', layout=2, wave=1, angle=90, teeth=7, copies=6, shade=1, shadeStyle=1, amplitude=1.1, compression=0),
    look('Scallops', ['#3df2ff', '#0b0c10'], paper='#0b0c10', layout=1, wave=7, angle=90, teeth=5, copies=7, compression=0, inkMode=1),
    look('Tapered brush', ['#111111'], angle=-8, teeth=7, weight=0.09, taper=-0.9, jitter=0.35, compression=0.5, corner=0.4),
    look('Concentric saws', ['#ff2bd6', '#0b0c10', '#c6ff00'], paper='#0b0c10', layout=3, teeth=16, copies=3, fill=1, inkMode=1, radius=0.8),
    look('Receding fins', ['#1d3bff'], layout=2, angle=90, teeth=9, copies=9, depth=0.9, shade=0.8, compression=0),
    look('Hatched waveform', ['#1d3bff'], layout=5, wave=3, angle=90, teeth=5, copies=3, shade=1, shadeStyle=2, compression=0),
]
recipes.append(dict(
    id='survey-sawtooth-spring', name='Sawtooth and spring', group='Continuous paths', renderer='motif-survey-sawtooth-spring',
    parameters=parameters,
    traits=dict(angularity=0.9, curvature=0.25, detail=0.6, mass=0.55, regularity=0.8, counterform=0.4, directionality=0.95, volume=0.3),
    styles=['optical', 'experimental', 'geometric'],
    fontTarget=dict(weight=0.8, width=0.75, serif=0, mono=0, italic=0),
    idealAspect=0.7,
    tags=['zigzag', 'sawtooth', 'spring', 'chevron', 'compression', 'op-art'],
    logic=('One waveform (zigzag with an adjustable lean, sawtooth, square, sine, looping coil, heartbeat pulse, stairs, bouncing '
           'arcs or seeded audio noise) is laid along a run: a straight or bent line, a ring or a spiral. Its turns can compress toward '
           'one end like a loaded spring and its swing can grow or shrink. It is drawn as a band (a spring with a cut, round, arrow '
           'or snake-head end, a sawblade or sun, a coiled spiral), as stripes that tile the field exactly, as rows of fins, or '
           'mirrored into a waveform; rows can recede. Every straight side or half period is a face: faces fold into two tones or '
           'shade from a dark base as a gradient, halftone or hatch. Bands taper and dash. Effects stack over the whole drawing: '
           'an extruded depth, a second ink printed out of register, and glitch slices. Rounded corners, a hand-drawn wobble, graph '
           'paper, neon glow, outlines and the title along the band finish it.'),
    references=[
        dict(queryID='visual-census-2026-11-08', posterID='38ea852fb2916941009ed64d-p0', sourceImageSHA256='108ab20b4ad4fd122d0cadd9ccc24f0423a8686a41279c741e24fe98a3847881'),
        dict(queryID='visual-census-2026-11-08', posterID='9b8d217221b58c9f0d455a8d-p0', sourceImageSHA256='12ab8e83b2458c53b988f6bf685b9fc435d0c52f04a323bd202114bf2802e7ff'),
        dict(queryID='visual-census-2026-11-08', posterID='074737af2aab5b910bbb5ad3-p0', sourceImageSHA256='c80ae7b634a186b358f1c9034d688ec477da41b81403829113745e2c8010965d'),
        dict(queryID='visual-census-2026-11-08', posterID='39c209ac67411dd6f8561caf-p0', sourceImageSHA256='c90d9d5be9919166198931591cf4dcb5ecf7203a997182a80270011647af4f06'),
        dict(queryID='visual-census-2026-11-08', posterID='b3a1da0e01f987a452176b5f-p0', sourceImageSHA256='1c21d3dd542cef733440e1b2f7669b282ca123854292ef6d3ce69d91c5c4570f'),
        dict(queryID='visual-census-2026-11-08', posterID='d01f2ac884d7cdc8394fd7de-p0', sourceImageSHA256='dc00337ebb1aed07e3317f279b95a945cdad6869718f6a8fe1611380cd5179a9'),
    ],
    basis=('Canonical source: Kevin Drumm at ECAL, 2018 (census 0255, credited to Notter+Vigne): one heavy zigzag stroke whose turns '
           'tighten toward the foot of the poster. Also Komet Soirée graphique (0702, a zigzag snake), Printemps culturel Neuchâtel '
           '(0029, chevron stripes), Claudia Basel (0262, shaded sawtooth fins), Volumes (0807, chevron arrows) and Neubad Luzern '
           '(0948, an outlined zigzag on graph paper).'),
    inks=['#121212', '#8f8f8f'],
    looks=looks,
))
for r in recipes:
    if r['id'] == 'survey-sawtooth-spring':
        assert all(x['min'] <= x['value'] <= x['max'] for x in r['parameters'])
        for l in r['looks']:
            for k, v in l['parameters'].items():
                q = next(x for x in r['parameters'] if x['id'] == k)
                assert q['min'] <= v <= q['max'], (l['name'], k, v)
path.write_text(json.dumps(recipes, indent=2, ensure_ascii=False) + '\n')
print(f'Sawtooth and spring: {len(parameters)} parameters, {len(looks)} looks -> {path}')

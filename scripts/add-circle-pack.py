"""Add (or replace) the circle-packing survey recipe in SurveyRecipes.json. Idempotent.
Usage: python3 -I scripts/add-circle-pack.py [project-root]   (defaults to this workspace)"""
from pathlib import Path
import json, sys
root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
path = root / 'Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json'
recipes = [r for r in json.loads(path.read_text()) if r['id'] != 'survey-circle-pack']
def p(id, label, v, lo, hi, step=.001, when=None, within=None):
    d = dict(id=id, label=label, value=v, min=lo, max=hi, step=step)
    if when: d['activeWhen'] = when
    if within: d['activeIn'] = within
    return d
angled = {'mark': [3, 4, 5, 6, 7, 8, 9]}
parameters = [
    p('layout', 'Largest gap first / Apollonian gasket / rolling rows / sunflower / lattice', 0, 0, 4, 1),
    p('container', 'Field: rectangle / circle / arch / triangle / diamond', 0, 0, 4, 1, within={'layout': [0, 3, 4]}),
    p('size', 'Largest circle', 0.29, 0.02, 0.6, within={'layout': [0]}),
    p('minSize', 'Smallest circle', 0.07, 0.004, 0.3, within={'layout': [0, 1]}),
    p('count', 'Circles at most', 13, 1, 400, 1, within={'layout': [0, 1, 3, 4]}),
    p('bias', 'Big circles go: scattered / along the diagonal / centre / edges / foot / from the top left', 1, 0, 5, 1, within={'layout': [0]}),
    p('looseness', 'Looseness', 0.15, 0, 1, within={'layout': [0]}),
    p('falloff', 'Size falls off toward the edge (negative: the centre)', 0, -0.9, 0.9, within={'layout': [0, 4]}),
    p('start', 'Gasket starts from two halves / three equal circles / an off-centre pair', 0, 0, 2, 1, within={'layout': [1]}),
    p('split', 'Off-centre split', 0.62, 0.15, 0.85, when={'layout': 1, 'start': 2}),
    p('angle', 'Rotation', 0, 0, 175, 0.1, within={'layout': [1, 3, 4]}),
    p('rows', 'Rows', 4, 1, 12, 1, within={'layout': [2]}),
    p('perRow', 'Circles per row', 5, 1, 20, 1, within={'layout': [2]}),
    p('growth', 'Circles grow along the row', 0.5, -1, 1, within={'layout': [2]}),
    p('alternate', 'Alternate rows run back', 0, 0, 1, 1, within={'layout': [2]}),
    p('align', 'Sit on a baseline / strung on a centre line', 0, 0, 1, 1, within={'layout': [2]}),
    p('spread', 'Spiral spread (low: small circles at the centre)', 0.5, 0.25, 1.2, within={'layout': [3]}),
    p('pattern', 'Size field: radial / linear / waves / random', 0, 0, 3, 1, within={'layout': [4]}),
    p('gap', 'Gap between circles', 0, 0, 0.06),
    p('wedges', 'Wedges', 4, 0, 16, 1),
    p('wedgeWidth', 'Wedge width', 0.13, 0.02, 0.45),
    p('reach', 'Wedges reach the edge', 1, 0.2, 1),
    p('mark', 'Mark: disc / ring / target / half moon / pac / ball / halftone / hatch / flower / rounded square', 0, 0, 9, 1),
    p('inset', 'Marks inset in their slot', 0, 0, 0.6),
    p('markAngle', 'Mark angle', 0, -90, 90, 0.1, within=angled),
    p('spin', 'Each mark turns at random', 0, 0, 1, within=angled),
    p('rings', 'Target rings', 4, 2, 10, 1, when={'mark': 2}),
    p('cut', 'Pac opening', 0.22, 0.05, 0.45, when={'mark': 4}),
    p('screen', 'Screen size', 0.014, 0.005, 0.04, within={'mark': [6, 7]}),
    p('lobes', 'Petals', 8, 3, 18, 1, when={'mark': 8}),
    p('roundness', 'Square roundness', 0.3, 0, 1, when={'mark': 9}),
    p('line', 'Line weight', 0.01, 0.002, 0.05, within={'mark': [1, 7]}),
    p('inkMode', 'Inks: one / by size / alternating / random / blended by size / blended down the field', 0, 0, 5, 1),
    p('field', 'Filled field', 1, 0, 1, 1),
    p('holes', 'Circles and wedges punched out of the field', 0, 0, 1, 1),
    p('outline', 'Outlined', 0, 0, 1, 1),
    p('shadow', 'Cut-paper shadow', 0, 0, 1),
    p('misregister', 'Second ink out of register', 0, 0, 1),
    p('letters', 'Title letters: none / one per circle / packed with the circles / letters only', 0, 0, 3, 1),
    p('letterTurn', 'Packed letters turn', 0, 0, 1, within={'letters': [2, 3]}),
]
def look(name, inks, paper=None, **values):
    d = dict(name=name, parameters=values, inks=inks)
    if paper: d['paper'] = paper
    return d
looks = [
    look('Spektakuli', ['#e2262b', '#e6df2a', '#ecebe6'], '#e9e8e3'),
    look('Paper cut', ['#d8362e', '#d8362e', '#e9e8e3'], '#e9e8e3', holes=1),
    look('Apollonian gasket', ['#1f3a8a', '#efe9dc'], '#efe9dc', layout=1, minSize=0.012, count=260, field=0, wedges=0),
    look('Gasket cut-out', ['#141414', '#141414', '#f2efe6'], '#f2efe6', layout=1, start=1, holes=1, count=120, minSize=0.015, wedges=3),
    look('Rolling rows', ['#1d1d1b', '#f0ece2'], '#f0ece2', layout=2, rows=5, perRow=6, growth=0.7, alternate=1, field=0, wedges=0),
    look('Date rows', ['#e2262b', '#e6df2a', '#f4f2ec'], '#f4f2ec', layout=2, rows=3, perRow=4, growth=0.4, letters=1, wedges=3),
    look('Sunflower', ['#2f6b3c', '#efe8d6'], '#efe8d6', layout=3, container=1, count=240, field=0, wedges=0),
    look('Sunflower burst', ['#e85d2a', '#f3efe4', '#f4c430', '#2b4c7e'], '#f3efe4', layout=3, count=160, spread=0.8, inkMode=4, field=0, wedges=0),
    look('Halftone lattice', ['#141414', '#f1ede4'], '#f1ede4', layout=4, count=320, falloff=0.9, field=0, wedges=0),
    look('Wave lattice', ['#1e4fa0', '#dfe8ec'], '#f2f0ea', layout=4, count=260, pattern=2, falloff=0.85, angle=30, wedges=0),
    look('Targets', ['#c8102e', '#f3eee3'], '#f3eee3', count=30, minSize=0.03, mark=2, rings=5, field=0, wedges=0),
    look('Half moons', ['#264653', '#e9c46a', '#f4f1e8', '#e76f51'], '#f4f1e8', count=40, minSize=0.025, mark=3, spin=1, field=0, wedges=0),
    look('Pac field', ['#111111', '#f2c12e'], count=60, minSize=0.02, mark=4, cut=0.25, spin=0.5, wedges=0),
    look('Shaded balls', ['#d94f30', '#1c2541'], count=50, minSize=0.02, bias=4, mark=5, markAngle=-30, wedges=0),
    look('Dot screen', ['#1d3557', '#f1faee'], '#f1faee', count=25, mark=6, screen=0.012, field=0, wedges=0),
    look('Hatched bubbles', ['#202020', '#ece6d6'], '#ece6d6', count=40, minSize=0.02, mark=7, markAngle=45, spin=0.3, line=0.004, screen=0.012, field=0, wedges=0),
    look('Flowers', ['#e4572e', '#f6efe0', '#76b041', '#17bebb', '#ffc914'], '#f6efe0', count=45, minSize=0.025, mark=8, lobes=9, inkMode=3, field=0, wedges=0),
    look('Squares in slots', ['#0b3c5d', '#d9b310'], count=60, minSize=0.02, mark=9, roundness=0.25, spin=0.4, wedges=0),
    look('Bubble foam', ['#1a1a1a', '#f0ede5'], '#f0ede5', bias=0, count=320, minSize=0.008, size=0.14, looseness=0.4, mark=1, line=0.004, field=0, wedges=0),
    look('Arch window', ['#f2ede3', '#2a4d8f', '#e9b44c'], container=2, count=30, minSize=0.03, wedges=5),
    look('Triangle pile', ['#c1121f', '#fdf0d5', '#003049'], container=3, bias=4, count=60, minSize=0.02, size=0.2, wedges=3),
    look('Diamond', ['#3a5a40', '#dad7cd'], container=4, bias=2, falloff=0.7, count=80, minSize=0.012, wedges=0),
    look('Shard burst', ['#1747a6', '#f2efe7', '#111111'], count=18, wedges=12, wedgeWidth=0.2),
    look('Cut-paper shadow', ['#e07a1f', '#e07a1f', '#f6f2ea'], '#f6f2ea', holes=1, shadow=1, count=20),
    look('Riso offset', ['#ff48b0', '#f4f0e6', '#0078bf'], '#f4f0e6', count=22, misregister=1),
    look('Gradient sizes', ['#111111', '#ece4d4'], '#ece4d4', bias=2, falloff=0.85, count=200, minSize=0.01, size=0.22, field=0, wedges=0),
    look('Kissing chain', ['#b5179e', '#f7f1e8'], '#f7f1e8', layout=2, align=1, rows=6, perRow=7, growth=-0.6, alternate=1, mark=1, line=0.006, field=0, wedges=0),
    look('Packed title', ['#e2262b', '#e6df2a', '#ecebe6'], '#e9e8e3', letters=2, count=40, minSize=0.03, gap=0.008, wedges=3),
    look('Letter foam', ['#1b1b1b', '#efe9dc'], '#efe9dc', letters=3, count=90, minSize=0.018, size=0.24, bias=0, field=0, wedges=0),
    look('Tumbling letters', ['#2a4d8f', '#f2ede3', '#e9b44c', '#d1495b'], '#f2ede3', letters=3, letterTurn=1, count=70, minSize=0.02, inkMode=3, field=0, wedges=0),
    look('Letters and dots', ['#111111', '#f4f0e6', '#ff48b0'], '#f4f0e6', letters=2, count=160, minSize=0.012, size=0.26, gap=0.006, field=0, wedges=0),
    look('Confetti scatter', ['#ef476f', '#fffcf2', '#ffd166', '#06d6a0', '#118ab2'], '#fffcf2', bias=0, looseness=1, count=40, minSize=0.025, inkMode=3, field=0, wedges=0),
]
recipes.append(dict(
    id='survey-circle-pack', name='Circle packing', group='Density fields', renderer='motif-survey-circle-pack',
    parameters=parameters,
    traits=dict(angularity=0.35, curvature=0.95, detail=0.55, mass=0.75, regularity=0.6, counterform=0.55, directionality=0.4, volume=0.2),
    styles=['swiss', 'geometric', 'playful'],
    fontTarget=dict(weight=0.35, width=0.5, serif=0, mono=0, italic=0),
    idealAspect=0.71, tags=['circles', 'packing', 'kissing', 'wedges', 'apollonian', 'figure-ground'],
    logic='Circles are packed into a field until they kiss: the largest gap first (capped by a size that can fall off '
          'toward the edge or the centre, with ties going to snug places along a diagonal, at the centre, the edges or '
          'the foot), an Apollonian gasket, rolling rows of tangent circles that grow along the row, a golden-angle '
          'sunflower, or a hex lattice whose sizes follow a radial, linear, wave or random field. The field can be a '
          'rectangle, circle, arch, triangle or diamond. Sharp wedges run from the kissing points out through the gaps '
          'to the field edge. Every circle carries one mark (disc, ring, target, half moon, pac, shaded ball, halftone, '
          'hatch, flower or rounded square) in one ink or several. The field is filled, or the circles and wedges are '
          'punched out of it; a cut-paper shadow, a misregistered second printing, outlines and the title set one '
          'letter per circle finish it. Type sits inside the largest circles.',
    references=[],
    basis='Source: Spektakuli, Miller\'s Zürich 2017 (Kabarett und Kleinkunst Festival), supplied by the user with a '
          'simplified study of its shapes: red circles of falling size packed tangent to each other and to the frame '
          'on a yellow field, the two largest on the diagonal carrying the title, white wedges running from the kissing '
          'points to the edges, and the dates set one figure per circle. Constructions are interpretations, not traced.',
    inks=['#e2262b', '#e6df2a', '#ecebe6'], looks=looks))
path.write_text(json.dumps(recipes, indent=2, ensure_ascii=False) + '\n')
print(f'{len(parameters)} parameters, {len(looks)} looks -> {path}')

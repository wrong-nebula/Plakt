"""Add (or replace) the orbit-wrap survey recipe in SurveyRecipes.json. Idempotent.
Usage: python3 -I scripts/add-orbit-wrap.py [project-root]   (defaults to this workspace)"""
from pathlib import Path
import json, sys
root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
path = root / 'Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json'
recipes = [r for r in json.loads(path.read_text()) if r['id'] != 'survey-orbit-wrap']
def p(id, label, v, lo, hi, step=.001, when=None):
    d = dict(id=id, label=label, value=v, min=lo, max=hi, step=step)
    if when: d['activeWhen'] = when
    return d
parameters = [
    p('path', 'Path: rings / coil / atom / double coil / Saturn / gimbals / knot / crown / swarm / whirl', 1, 0, 9, 1),
    p('turns', 'Rings, turns or orbits', 5, 1, 9, 1),
    p('profile', 'Cylinder / sphere / cone / hourglass / barrel / funnel', 0, 0, 5, 1),
    p('radius', 'Orbit radius (field widths)', 0.56, 0.15, 0.8),
    p('height', 'Axis length', 0.78, 0.1, 1),
    p('tilt', 'Camera height (negative: from below)', 0.16, -0.6, 0.6),
    p('lean', 'Lean in degrees', -6, -40, 40, 0.1),
    p('centerX', 'Axis across', 0.5, 0.2, 0.8),
    p('centerY', 'Axis down', 0.5, 0.2, 0.8),
    p('band', 'Band width', 0.045, 0.004, 0.12),
    p('bandStyle', 'Band: tube / tape / twisted ribbon / beads / hairline / dashes / chain / zipper / double line / striped tape', 0, 0, 9, 1),
    p('twist', 'Ribbon half-twists per turn', 1, 0, 4, 0.5, {'bandStyle': 2}),
    p('shade', 'Tube shading', 0, 0, 1, when={'bandStyle': 0}),
    p('satellites', 'Satellites on the hairline', 2, 0, 6, 1, {'bandStyle': 4}),
    p('outline', 'Outlined bands', 0, 0, 1, 1),
    p('perspective', 'Near arcs thicker', 0.2, 0, 1),
    p('backFade', 'Far arcs fade into the paper', 0, 0, 1),
    p('inkMode', 'One ink / near and far / stepped / blended / alternating', 2, 0, 4, 1),
    p('subject', 'Subject: title only / solid / slab / glow / torus / pill / star / striped orb', 1, 0, 7, 1),
    p('subjectScale', 'Subject size', 0.5, 0.2, 0.95),
    p('shadeSubject', 'Subject shading', 0.35, 0, 1),
    p('incline', 'Crossed-orbit inclination', 0.95, 0.2, 1.5, when={'path': 2}),
    p('wobble', 'Ring wobble', 0, 0, 1, when={'path': 0}),
    p('shift', 'Rings slide along the axis', 0, -1, 1, when={'path': 0}),
    p('spin', 'Spin', 0, 0, 1),
    p('keyline', 'Paper keyline round near arcs', 0, 0, 1),
    p('glow', 'Neon glow', 0, 0, 1),
    p('bandCopy', 'Title printed on the band', 0, 0, 1, 1),
    # v2: all neutral at their defaults, so v1 presets and genomes draw unchanged.
    p('knotLobes', 'Knot lobes', 3, 2, 7, 1, {'path': 6}),
    p('crownWaves', 'Crown waves', 5, 2, 9, 1, {'path': 7}),
    p('wave', 'Crown wave height', 0.5, 0, 1, when={'path': 7}),
    p('rungs', 'Ladder rungs per turn', 0, 0, 12, 1, {'path': 3}),
    p('dashDuty', 'Dash length', 0.5, 0.15, 0.85, when={'bandStyle': 5}),
    p('bend', 'Axis bend', 0, -1, 1),
    p('taper', 'Band taper along the orbits', 0, -1, 1),
    p('jitter', 'Radius jitter', 0, 0, 1),
    p('spacing', 'Turn spacing ramp', 0, -1, 1),
    p('echo', 'Echo trail copies', 0, 0, 5, 1),
    p('shadow', 'Drop shadow on the paper', 0, 0, 1),
    p('depthBlur', 'Far arcs out of focus', 0, 0, 1),
    p('backCopy', 'Title shows through on the far arcs, mirrored', 0, 0, 1, 1, {'bandCopy': 1}),
]
def look(name, inks, paper=None, **values):
    known = {x['id'] for x in parameters}
    assert set(values) <= known, set(values) - known
    d = dict(name=name, parameters=values, inks=inks)
    if paper: d['paper'] = paper
    return d
looks = [
    look('Coil round a figure', ['#ef4a3f', '#d9b8f2', '#151515']),
    look('Wound tape', ['#141414', '#ef4a3f'], path=1, turns=4, bandStyle=1, band=0.11, radius=0.62, height=0.84, tilt=0.24, lean=-9,
         inkMode=0, subject=0, bandCopy=1, perspective=0),
    look('Hoop column', ['#1fc79b', '#2a2a2a'], path=0, turns=4, bandStyle=1, outline=1, band=0.12, radius=0.4, height=0.82, tilt=0.22,
         lean=0, inkMode=0, subject=0, perspective=0.1),
    look('Halo', ['#f2d21b', '#1d1d1d'], paper='#141414', path=0, turns=1, shift=-0.95, bandStyle=4, satellites=0, band=0.035, radius=0.36, height=0.8,
         tilt=0.2, lean=0, inkMode=0, subject=0, perspective=0),
    look('Neon atom', ['#39ff88', '#ff2bd6', '#3df2ff', '#ffffff'], paper='#0b0c10', path=2, turns=3, bandStyle=0, band=0.016, shade=0.7, glow=0.8,
         radius=0.42, height=0.84, incline=1.0, tilt=0.1, lean=0, inkMode=4, subject=3, subjectScale=0.32, perspective=0.5),
    look('Neon rings', ['#00e5ff', '#ff2bd6'], paper='#0b0c10', path=0, turns=6, bandStyle=0, band=0.02, shade=0.8, glow=1, perspective=0.5, backFade=0.45,
         inkMode=3, subject=0, radius=0.6, height=0.72, tilt=0.12, lean=-4),
    look('Globe beads', ['#ff5a1f', '#ffd23f', '#1b1b3a'], path=0, turns=7, profile=1, bandStyle=3, band=0.022, subject=1, subjectScale=0.82,
         radius=0.42, height=0.8, tilt=0.32, lean=8, inkMode=3, perspective=0.7),
    look('Double coil', ['#2f5bff', '#ff3d6e'], path=3, turns=3, bandStyle=0, band=0.05, shade=0.7, perspective=0.6, radius=0.34, height=0.92,
         tilt=0.26, lean=0, inkMode=4, subject=0),
    look('Twisted ribbon', ['#ffd400', '#ff4fa3', '#151515'], path=1, turns=3, bandStyle=2, twist=2, band=0.1, radius=0.52, height=0.74, tilt=0.34,
         lean=-6, inkMode=0, subject=0, perspective=0.3),
    look('Hourglass spring', ['#111111', '#ff3b30', '#d7d2c8'], path=1, turns=9, profile=3, bandStyle=4, satellites=3, band=0.03,
         radius=0.44, height=0.9, tilt=0.2, lean=0, inkMode=0, subject=1, subjectScale=0.6),
    look('Cone vortex', ['#7b2cff', '#ff2fb3', '#101014'], path=1, turns=7, profile=2, bandStyle=0, band=0.032, shade=0.5, inkMode=3,
         lean=12, tilt=0.36, subject=1, subjectScale=0.62, radius=0.46, height=0.86, perspective=0.4),
    # v2 looks: new paths, bands, subjects and finishing.
    look('Saturn', ['#ffd23f', '#ff8a00', '#ff3b5c'], paper='#0b0c10', path=4, turns=4, bandStyle=1, band=0.06, radius=0.66, height=0.6,
         tilt=0.24, lean=-16, inkMode=3, subject=7, subjectScale=0.52, shadeSubject=0.7, perspective=0.3),
    look('Chrome gimbals', ['#e6e9ee', '#9aa3ad', '#ffffff'], paper='#0e0f12', path=5, turns=4, bandStyle=0, shade=1, band=0.035, radius=0.46,
         height=0.8, tilt=0.15, lean=0, inkMode=4, subject=3, subjectScale=0.26, perspective=0.5),
    look('Trefoil knot', ['#ff2bd6'], paper='#0b0c10', path=6, knotLobes=3, bandStyle=0, shade=0.8, band=0.07, radius=0.44, height=0.62,
         tilt=0.3, lean=0, inkMode=0, subject=0, glow=0.6, perspective=0.5),
    look('Crown', ['#f2b705', '#e8482c', '#1a1a1a'], path=7, turns=2, crownWaves=6, wave=0.9, bandStyle=1, band=0.07, radius=0.46, height=0.6,
         tilt=0.26, lean=0, inkMode=2, subject=1, subjectScale=0.55, perspective=0.2),
    look('Electron swarm', ['#39ff88', '#3df2ff', '#ff2bd6', '#ffffff'], paper='#07080b', path=8, turns=6, bandStyle=4, satellites=1, band=0.022,
         glow=0.9, radius=0.5, height=0.86, tilt=0.2, lean=0, inkMode=4, subject=3, subjectScale=0.24, perspective=0.5),
    look('Whirlpool', ['#2f5bff', '#00e5ff'], paper='#0b0c10', path=9, turns=6, bandStyle=0, shade=0.6, band=0.05, taper=0.9, tilt=0.42,
         radius=0.64, lean=-10, inkMode=3, subject=0, glow=0.3, perspective=0.5),
    look('Slinky arc', ['#d5d9df', '#8a919b'], paper='#ff3d2e', path=1, turns=9, bend=0.5, bandStyle=0, shade=0.9, band=0.026, radius=0.32,
         height=0.84, tilt=0.38, lean=0, inkMode=4, subject=0, perspective=0.4),
    look('Tornado', ['#151515'], paper='#e9e4d8', path=1, turns=9, profile=5, bandStyle=0, band=0.014, jitter=0.9, echo=2, radius=0.5,
         height=0.86, lean=6, tilt=0.3, subject=0, inkMode=0, perspective=0.4),
    look('DNA ladder', ['#00e5ff', '#ff2bd6', '#f2f2f2'], paper='#0b0c10', path=3, turns=3, rungs=8, bandStyle=0, shade=0.7, band=0.045,
         radius=0.32, height=0.92, tilt=0.22, lean=18, subject=0, inkMode=4, perspective=0.5),
    look('Gold chain', ['#f2c94c', '#9b7a1c', '#f2efe8'], paper='#0b0c10', path=1, turns=4, bandStyle=6, band=0.05, radius=0.5, height=0.74,
         tilt=0.22, lean=-8, inkMode=0, subject=5, subjectScale=0.5, perspective=0.3),
    look('Zipper', ['#111111'], paper='#ffe100', path=1, turns=4, bandStyle=7, band=0.07, radius=0.52, height=0.76, tilt=0.2, lean=-6,
         inkMode=0, subject=0, perspective=0.2),
    look('Barcode coil', ['#111111'], paper='#f4f1e8', path=1, turns=4, bandStyle=5, dashDuty=0.3, band=0.11, radius=0.56, tilt=0.2,
         lean=-8, inkMode=0, subject=0, perspective=0.3),
    look('Möbius', ['#ff4fa3', '#ffd400'], path=0, turns=1, bandStyle=2, twist=1, band=0.12, radius=0.5, height=0.5, tilt=0.4, lean=-8,
         inkMode=0, subject=0, perspective=0.3),
    look('Neon track', ['#00ffa3', '#ff2bd6'], paper='#07080b', path=1, turns=6, bandStyle=8, band=0.04, glow=1, radius=0.58, height=0.8,
         tilt=0.16, lean=-6, inkMode=3, subject=0, perspective=0.4),
    look('Star orbit', ['#ff3b8d', '#2f5bff', '#ffe600'], path=2, turns=3, bandStyle=0, shade=0.6, band=0.024, subject=6, subjectScale=0.62,
         shadeSubject=0.8, radius=0.46, height=0.8, incline=1.0, tilt=0.1, lean=0, inkMode=4, perspective=0.5),
    look('Donut', ['#3df2ff', '#ff6fb5'], paper='#101014', path=2, turns=2, bandStyle=4, satellites=2, band=0.03, subject=4, subjectScale=0.7,
         shadeSubject=0.8, radius=0.5, height=0.7, tilt=0.55, incline=1.2, lean=0, inkMode=0, glow=0.5, perspective=0.4),
    look('Show-through tape', ['#111111'], paper='#ffe100', path=0, turns=3, bandStyle=1, band=0.1, bandCopy=1, backCopy=1, radius=0.5,
         height=0.72, tilt=0.3, lean=-5, subject=0, inkMode=0, perspective=0.1),
    look('Soft focus', ['#ef4a3f', '#d9b8f2', '#151515'], shadow=0.9, depthBlur=0.7, perspective=0.6),
]
recipes.append(dict(
    id='survey-orbit-wrap', name='Orbit wrap', group='Wrapped forms', renderer='motif-survey-orbit-wrap',
    parameters=parameters,
    traits=dict(angularity=0.15, curvature=0.95, detail=0.55, mass=0.5, regularity=0.8, counterform=0.45, directionality=0.6, volume=0.9),
    styles=['optical', 'experimental', 'abstract'],
    fontTarget=dict(weight=0.75, width=0.85, serif=0, mono=0, italic=0),
    idealAspect=0.7,
    tags=['orbit', 'coil', 'depth-occlusion', 'wrap', 'rings', 'helix', 'torus-knot', 'saturn', 'gimbals', 'swarm'],
    logic=('Rings, a coil, crossed orbits or a double coil are wound round a vertical axis, seen by a raised camera and leaned in the page. '
           'The far half of every orbit is drawn first, then the subject (a solid on the orbit\'s own profile, a slab or a glow), then the poster type, '
           'then the near half of every orbit above it all, so the title sits inside the rings. Bands are round tubes, flat tape that shows its '
           'darker inside on the far arcs, twisted ribbon, beads or a hairline with satellites; inks run near/far, stepped or blended by turn, or '
           'alternate. Type mode prints the title on the near face of the band, foreshortened toward the sides, and can let it show through '
           'mirrored on the far arcs. Further paths: flat Saturn rings, nested gimbals, a torus knot, a wavy crown, a swarm of small orbits and a '
           'whirl; further bands: dashes, chain links, zipper teeth, double neon rails and striped tape; further subjects: torus, pill, faceted '
           'star and striped orb. The axis can bend, the band can taper, radii can jitter, turns can crowd toward one end, and echo trails, a '
           'drop shadow and out-of-focus far arcs finish it.'),
    references=[
        dict(queryID='visual-census-2026-11-08', posterID='3d8e000461288fa4d371c9e1-p0', sourceImageSHA256='eb2c0224da2da4fc762da84b977e4a20891475831019b410acd92087dd6d98a0'),
        dict(queryID='visual-census-2026-11-08', posterID='98fc1698f85d5119e2d66668-p0', sourceImageSHA256='173e7aaf7b6b86127a1db1a80ab204b1e6244151f3ff87b5c099ecdb22fe6f57'),
        dict(queryID='visual-census-2026-11-08', posterID='f0c8847d3dc2e3bf084e0a25-p0', sourceImageSHA256='ecf06400fc5fa692bf6ab5245843c0404b29536ee0f08950accc479341d1a14b'),
        dict(queryID='visual-census-2026-11-08', posterID='e8a0872a4d94463a52537f14-p0', sourceImageSHA256='2f3dc565ca4dd1b82fb1fd3081461a2b1caabba142a6e293ad88aad2f8825789'),
    ],
    basis=('Canonical source: Filmpodium "Marilyn Monroe Revisited", 2023 (census 0277): a thick two-colour coil wound round a figure, '
           'the near arcs over it and the far arcs behind. Also Journées de Soleure 2023 (0690, hoops round a column), Abstract (1062, a halo) '
           'and Mehrspur Pop & Jazz (1035, copy on a wound band).'),
    inks=['#ef4a3f', '#d9b8f2', '#151515'],
    looks=looks,
))
for r in recipes:
    if r['id'] == 'survey-orbit-wrap':
        assert all(x['min'] <= x['value'] <= x['max'] for x in r['parameters'])
        for l in r['looks']:
            for k, v in l['parameters'].items():
                q = next(x for x in r['parameters'] if x['id'] == k)
                assert q['min'] <= v <= q['max'], (l['name'], k, v)
path.write_text(json.dumps(recipes, indent=2, ensure_ascii=False) + '\n')
print(f'Orbit wrap: {len(parameters)} parameters, {len(looks)} looks -> {path}')

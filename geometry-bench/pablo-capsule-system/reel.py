"""Encode the reel frames written by reel.mjs as a looping GIF (and an MP4 when ffmpeg exists).

    python3 reel.py [--width 1600]
"""
from pathlib import Path
import json, shutil, subprocess, sys
from PIL import Image

FRAMES = Path(__file__).resolve().parents[2] / 'output/pablo-capsule-study-v1/reel/frames'
OUT = FRAMES.parent
width = int(sys.argv[sys.argv.index('--width') + 1]) if '--width' in sys.argv else None
timing = json.loads((FRAMES / 'timing.json').read_text())

def load(entry):
    image = Image.open(FRAMES / entry['file']).convert('RGB')
    if width and image.width != width:
        image = image.resize((width, round(image.height * width / image.width)), Image.Resampling.LANCZOS)
    # Flat poster colours plus their anti-aliased edges fit an adaptive palette without dithering.
    return image.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)

frames = [load(entry) for entry in timing]
size = frames[0].width
name = f'capsule-reel-{size}.gif'
frames[0].save(OUT / name, save_all=True, append_images=frames[1:], duration=[t['ms'] for t in timing], loop=0, disposal=1, optimize=False)
print(f'{name}: {len(frames)} frames, {(OUT / name).stat().st_size / 1e6:.1f} MB')

if shutil.which('ffmpeg') and not width:
    concat = FRAMES / 'concat.txt'
    concat.write_text(''.join(f"file '{t['file']}'\nduration {t['ms'] / 1000}\n" for t in timing) + f"file '{timing[-1]['file']}'\n")
    mp4 = OUT / f'capsule-reel-{size}.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(concat), '-vf', 'fps=50,format=yuv420p',
                    '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-movflags', '+faststart', str(mp4)], check=True)
    print(f'{mp4.name}: {mp4.stat().st_size / 1e6:.1f} MB')

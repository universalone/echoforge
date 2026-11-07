"""Draws the EchoForge mark (same geometry as app/assets/logo.svg) to icon.png and icon.ico.
Run:  python tools/make_icon.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'app', 'assets')
SS = 4            # supersampling
N = 256 * SS

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def ember(t):
    stops = [(0, (0xFF, 0xD2, 0x7A)), (0.45, (0xFF, 0x6A, 0x1F)), (1, (0xE5, 0x14, 0x5F))]
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        if t <= t1:
            return lerp(c0, c1, (t - t0) / (t1 - t0))
    return stops[-1][1]

def gradient():
    g = Image.new('RGB', (N, N))
    px = g.load()
    for y in range(N):
        for x in range(N):
            px[x, y] = ember(min(1, (x + y) / (2 * N)))
    return g

def P(pts):
    return [(x * SS, y * SS) for x, y in pts]

hexo = [(128, 14), (227, 71), (227, 185), (128, 242), (29, 185), (29, 71)]
blades = [
    [(76, 70), (100, 70), (100, 186), (76, 186)],
    [(76, 70), (182, 70), (170, 92), (76, 92)],
    [(76, 117), (160, 117), (148, 139), (76, 139)],
    [(76, 164), (170, 164), (182, 186), (76, 186)],
]
echoes = [
    ([(188, 70), (202, 70), (190, 92), (176, 92)], .55), ([(208, 70), (216, 70), (204, 92), (196, 92)], .25),
    ([(166, 117), (180, 117), (168, 139), (154, 139)], .55), ([(186, 117), (194, 117), (182, 139), (174, 139)], .25),
    ([(176, 164), (190, 164), (202, 186), (188, 186)], .55), ([(196, 164), (204, 164), (216, 186), (208, 186)], .25),
]
spark = [(196, 40), (200, 52), (212, 56), (200, 60), (196, 72), (192, 60), (180, 56), (192, 52)]

grad = gradient()
img = Image.new('RGBA', (N, N), (0, 0, 0, 0))

# dark core
core = Image.new('L', (N, N), 0); ImageDraw.Draw(core).polygon(P(hexo), fill=255)
img.paste((16, 15, 19, 255), (0, 0), core)

# ember ring
ring = Image.new('L', (N, N), 0); d = ImageDraw.Draw(ring)
d.line(P(hexo + [hexo[0]]), fill=255, width=9 * SS, joint='curve')
img.paste(grad, (0, 0), ring)

# blades with glow
bm = Image.new('L', (N, N), 0); d = ImageDraw.Draw(bm)
for b in blades:
    d.polygon(P(b), fill=255)
glow = bm.filter(ImageFilter.GaussianBlur(5 * SS)).point(lambda v: int(v * .7))
img.paste(grad, (0, 0), glow)
img.paste(grad, (0, 0), bm)

for pts, a in echoes:
    m = Image.new('L', (N, N), 0); ImageDraw.Draw(m).polygon(P(pts), fill=int(255 * a))
    img.paste((0xFF, 0x8A, 0x3D, 255), (0, 0), m)
m = Image.new('L', (N, N), 0); ImageDraw.Draw(m).polygon(P(spark), fill=255)
img.paste((0xFF, 0xE2, 0xA8, 255), (0, 0), m)

final = img.resize((256, 256), Image.LANCZOS)
final.save(os.path.join(ASSETS, 'icon.png'))
final.save(os.path.join(ASSETS, 'icon.ico'), sizes=[(256, 256), (64, 64), (48, 48), (32, 32), (16, 16)])
print('icon.png + icon.ico written')

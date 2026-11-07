"""Builds a fake game library for testing EchoForge's scanner (no real game data).
Run:  python tools/make_test_library.py <target-folder>
Creates PS4-style folders with PARAM.SFO + icon0.png and some dummy PS2 / Xbox 360 files.
"""
import os, shutil, struct, sys

def sfo(entries):
    keys = b''; data = b''; index = b''
    for k, v in entries:
        raw = v.encode('utf8') + b'\0'
        size = (len(raw) + 3) & ~3
        index += struct.pack('<HHIII', len(keys), 0x0204, len(raw), size, len(data))
        keys += k.encode() + b'\0'
        data += raw.ljust(size, b'\0')
    keys = keys.ljust((len(keys) + 3) & ~3, b'\0')
    key_start = 20 + len(index)
    return struct.pack('<4sIIII', b'\0PSF', 0x101, key_start, key_start + len(keys), len(entries)) + index + keys + data

root = sys.argv[1]
icon = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'assets', 'icon.png')
for cusa, title in [('CUSA00001', 'Forge Test: Ember Run'), ('CUSA00002', 'Echo Drift Racing'), ('CUSA00003', 'Hex Knights')]:
    d = os.path.join(root, 'PS4', cusa); os.makedirs(os.path.join(d, 'sce_sys'), exist_ok=True)
    open(os.path.join(d, 'eboot.bin'), 'wb').write(b'\0' * 1024)
    open(os.path.join(d, 'sce_sys', 'param.sfo'), 'wb').write(sfo([('TITLE', title), ('TITLE_ID', cusa)]))
    if cusa != 'CUSA00003':
        shutil.copy(icon, os.path.join(d, 'sce_sys', 'icon0.png'))
os.makedirs(os.path.join(root, 'PS2'), exist_ok=True)
for name in ['Sky Forge Chronicles (USA).iso', 'Tiny Tanks (Europe) [!].chd']:
    open(os.path.join(root, 'PS2', name), 'wb').write(b'\0' * 2048)
os.makedirs(os.path.join(root, 'X360'), exist_ok=True)
open(os.path.join(root, 'X360', 'Neon Harbor (USA).iso'), 'wb').write(b'\0' * 2048)
print('test library at', root)

// Catalog of console sections and emulator cores EchoForge knows about.
// Only official project pages are linked — fake "PS5 emulator" sites spread malware.

window.EF_GROUPS = [
  { id: 'next', name: 'Next-Gen', blurb: 'Bleeding edge. Experimental emulators, expect boots before playthroughs.' },
  { id: 'current', name: 'Current-Gen', blurb: 'PS4 emulation is real and improving every release.' },
  { id: 'hd', name: 'HD Era', blurb: 'Mature emulators, huge playable libraries.' },
  { id: 'classic', name: 'Classics', blurb: 'Rock-solid, runs at many times native resolution.' }
];

window.EF_CONSOLES = [
  {
    id: 'ps5', name: 'PlayStation 5', short: 'PS5', dir: 'Playstation 5', speed: 'fast', maker: 'Sony', group: 'next', year: 2020,
    hue: ['#dfe7f5', '#6d8fd6'], emulators: ['kytyps5', 'sharpemu'],
    rule: { names: ['eboot.bin'] }, accept: 'ps5',
    ram: 10, maturity: 'experimental',
    formats: 'Game folder containing eboot.bin and sce_sys/param.json',
    bios: [
      { id: 'sys', label: 'PS5 system libraries', any: true, required: false, help: 'Optional. KytyPS5 says it does not need firmware modules. If a game asks for them, dump them from your own PS5 and point the firmware folder at the dump.' }
    ]
  },
  {
    id: 'xone', name: 'Xbox One', short: 'ONE', dir: 'Xbox One', speed: 'fast', maker: 'Microsoft', group: 'next', year: 2013,
    hue: ['#9fe870', '#1f7a3a'], emulators: ['windurango'],
    rule: { names: ['appxmanifest.xml'] }, accept: 'any', launch: 'appx', // games run as installed Windows apps (app/appx.js)
    ram: 8, maturity: 'experimental',
    formats: 'Unpacked game package folder containing AppxManifest.xml (dumped from your console)',
    bios: []
  },
  {
    id: 'ps4', name: 'PlayStation 4', short: 'PS4', dir: 'Playstation 4', speed: 'fast', maker: 'Sony', group: 'current', year: 2013,
    hue: ['#7fb2ff', '#2546a8'], emulators: ['shadps4'],
    rule: { names: ['eboot.bin'], ext: ['.pkg'] }, accept: 'ps4',
    ram: 8, maturity: 'early',
    formats: 'Game folder with eboot.bin (CUSAxxxxx), or a .pkg to install inside shadPS4',
    bios: [
      { id: 'mods', label: 'sys_modules folder (.sprx libraries)', file: 'sys_modules', dir: true, required: false, help: 'Optional but recommended. Some games need firmware libraries dumped from your own PS4, placed in a folder called sys_modules.' }
    ]
  },
  {
    id: 'ps3', name: 'PlayStation 3', short: 'PS3', dir: 'Playstation 3', speed: 'any', maker: 'Sony', group: 'hd', year: 2006,
    hue: ['#c7c9d1', '#3a3d4a'], emulators: ['rpcs3'],
    rule: { names: ['eboot.bin'], ext: ['.iso'] }, accept: 'ps3',
    ram: 6, maturity: 'mature',
    formats: 'Disc folder (PS3_GAME/USRDIR/EBOOT.BIN), .iso, or installed PSN title',
    bios: [
      { id: 'pup', label: 'PS3 system software (PS3UPDAT.PUP)', file: 'PS3UPDAT.PUP', required: true, manual: true,
        inEmu: { emulator: 'rpcs3', file: 'dev_flash\\vsh\\etc\\version.txt', version: /release:0?(\d+\.\d\d)/ },
        help: 'Free and legal from Sony. Download it, then in RPCS3 use File → Install Firmware. EchoForge spots it automatically once RPCS3 has installed it.',
        url: 'https://www.playstation.com/en-us/support/hardware/ps3/system-software/' }
    ]
  },
  {
    id: 'x360', name: 'Xbox 360', short: '360', dir: 'Xbox 360', speed: 'any', maker: 'Microsoft', group: 'hd', year: 2005,
    hue: ['#d8f5a2', '#4b8a1e'], emulators: ['xenia'],
    rule: { ext: ['.iso', '.xex', '.zar'] }, accept: 'any',
    ram: 4, maturity: 'mature',
    formats: '.iso, .zar, default.xex, or extracted game folder',
    bios: []
  },
  {
    id: 'wii', name: 'Wii', short: 'Wii', dir: 'Wii', speed: 'any', maker: 'Nintendo', group: 'hd', year: 2006,
    hue: ['#f2f6fb', '#7aa6c9'], emulators: ['dolphin', 'retroarch'], core: 'dolphin',
    rule: { ext: ['.wbfs', '.rvz', '.iso', '.wad'] }, accept: 'any',
    ram: 3, maturity: 'mature', formats: '.rvz (recommended), .wbfs, .iso', bios: []
  },
  {
    id: 'xbox', name: 'Xbox', short: 'XBOX', dir: 'Xbox', speed: 'any', maker: 'Microsoft', group: 'classic', year: 2001,
    hue: ['#b9f27c', '#2b5c18'], emulators: ['xemu'],
    rule: { ext: ['.iso', '.xiso'] }, accept: 'any',
    ram: 3, maturity: 'good',
    formats: 'XISO-format .iso (convert disc images with extract-xiso)',
    bios: [
      { id: 'mcpx', label: 'MCPX boot ROM (mcpx_1.0.bin)', file: 'mcpx_1.0.bin', md5: 'd49c52a4102f6df7bcf8d0617ac475ed', required: true, help: 'Dumped from your own Xbox. EchoForge verifies the checksum so a bad dump is caught before you launch.' },
      { id: 'flash', label: 'Flash BIOS image (.bin)', pattern: '^(?!mcpx).*\\.bin$', required: true, help: 'Your console’s flash BIOS dump.' },
      { id: 'hdd', label: 'Hard disk image (.qcow2)', pattern: '\\.qcow2$', required: true, help: 'xemu’s documentation links a clean pre-built HDD image with no copyrighted content.', url: 'https://xemu.app/docs/required-files/' }
    ]
  },
  {
    id: 'ps2', name: 'PlayStation 2', short: 'PS2', dir: 'Playstation 2', speed: 'any', maker: 'Sony', group: 'classic', year: 2000,
    hue: ['#9aa8ff', '#1c2266'], emulators: ['pcsx2'],
    rule: { ext: ['.iso', '.chd', '.cso', '.gz'] }, accept: 'any',
    ram: 2, maturity: 'mature', formats: '.chd (smallest), .iso, .cso',
    bios: [{ id: 'bios', label: 'PS2 BIOS (scph*.bin)', pattern: '^(scph|ps2).*\\.bin$', required: true, help: 'Dumped from your own PS2 using the PCSX2 BIOS dumper.' }]
  },
  {
    id: 'gc', name: 'GameCube', short: 'GC', dir: 'GameCube', speed: 'any', maker: 'Nintendo', group: 'classic', year: 2001,
    hue: ['#b9a6ff', '#4a2f9c'], emulators: ['dolphin', 'retroarch'], core: 'dolphin',
    rule: { ext: ['.rvz', '.iso', '.gcm', '.ciso', '.gcz'] }, accept: 'any',
    ram: 2, maturity: 'mature', formats: '.rvz (recommended), .iso, .gcm', bios: []
  },
  {
    id: 'ps1', name: 'PlayStation', short: 'PS1', dir: 'Playstation', speed: 'any', maker: 'Sony', group: 'classic', year: 1994,
    hue: ['#d6d6d6', '#5c5c5c'], emulators: ['duckstation', 'retroarch'], core: 'pcsx_rearmed',
    rule: { ext: ['.cue', '.chd', '.pbp', '.m3u'] }, accept: 'any',
    ram: 1, maturity: 'mature', formats: '.chd, .cue/.bin, .pbp, .m3u for multi-disc',
    bios: [{ id: 'bios', label: 'PS1 BIOS (scph*.bin)', pattern: '^scph.*\\.bin$', required: false, help: 'Required by DuckStation; RetroArch’s PCSX ReARMed can run without one.' }]
  },
  {
    id: 'psp', name: 'PSP', short: 'PSP', dir: 'PSP', speed: 'any', maker: 'Sony', group: 'classic', year: 2004,
    hue: ['#e3e3ea', '#2d2d3a'], emulators: ['ppsspp', 'retroarch'], core: 'ppsspp',
    rule: { ext: ['.iso', '.cso', '.pbp', '.chd'] }, accept: 'any',
    ram: 1, maturity: 'mature', formats: '.iso, .cso, .chd', bios: []
  }
];

window.EF_EMULATORS = [
  { id: 'kytyps5', name: 'KytyPS5', for: ['ps5'], status: 'experimental', exe: ['kyty_emulator.exe', 'KytyPS5.exe', 'Kyty.exe', 'kyty.exe'], hint: ['kyty'],
    args: '"{rom}"', url: 'https://github.com/KytyPS5', note: 'Boots a handful of titles. Not playable yet.' },
  { id: 'sharpemu', name: 'SharpEmu', for: ['ps5'], status: 'experimental', exe: ['SharpEmu.exe'], hint: ['sharpemu', 'sharp'],
    args: '"{rom}"', url: 'https://x.com/rpcs3/status/2078143991363571972', note: 'Community-driven since July 2026. The link is RPCS3’s post naming the official repos.' },
  { id: 'windurango', name: 'WinDurango', for: ['xone'], status: 'experimental', exe: [], hint: ['durango'], nolink: true,
    args: '"{rom}"', url: 'https://github.com/WinDurango', note: 'Nothing to link: install each game with WinDurango’s steps and EchoForge starts it for you. Needs Windows Developer Mode. A few titles launch.' },
  { id: 'shadps4', name: 'shadPS4', for: ['ps4'], status: 'active', exe: ['shadPS4.exe', 'shadps4.exe'], hint: ['shadps4', 'shad'],
    args: '-g "{rom}"', url: 'https://github.com/shadps4-emu/shadPS4', note: 'The leading PS4 emulator. Needs a Vulkan 1.3 GPU.' },
  { id: 'rpcs3', name: 'RPCS3', for: ['ps3'], status: 'mature', exe: ['rpcs3.exe'], hint: ['rpcs3'],
    args: '--no-gui "{rom}"', url: 'https://rpcs3.net/download', note: 'Thousands of playable titles.' },
  { id: 'xenia', name: 'Xenia Canary', for: ['x360'], status: 'mature', exe: ['xenia_canary.exe', 'xenia.exe'], hint: ['xenia'],
    args: '"{rom}"', url: 'https://github.com/xenia-canary/xenia-canary', note: 'Most active Xbox 360 branch.' },
  { id: 'xemu', name: 'xemu', for: ['xbox'], status: 'good', exe: ['xemu.exe'], hint: ['xemu'],
    args: '-dvd_path "{rom}"', url: 'https://xemu.app', note: 'Low-level original Xbox emulation.' },
  { id: 'pcsx2', name: 'PCSX2', for: ['ps2'], status: 'mature', exe: ['pcsx2-qt.exe', 'pcsx2.exe'], hint: ['pcsx2'],
    args: '-batch -fullscreen -- "{rom}"', url: 'https://pcsx2.net', note: '' },
  { id: 'dolphin', name: 'Dolphin', for: ['gc', 'wii'], status: 'mature', exe: ['Dolphin.exe'], hint: ['dolphin'],
    args: '-b -e "{rom}"', url: 'https://dolphin-emu.org', note: '' },
  { id: 'duckstation', name: 'DuckStation', for: ['ps1'], status: 'mature', exe: ['duckstation-qt-x64-ReleaseLTCG.exe', 'duckstation-qt.exe'], hint: ['duckstation'],
    args: '-batch -fullscreen "{rom}"', url: 'https://github.com/stenzek/duckstation', note: '' },
  { id: 'ppsspp', name: 'PPSSPP', for: ['psp'], status: 'mature', exe: ['PPSSPPWindows64.exe', 'PPSSPPWindows.exe'], hint: ['ppsspp'],
    args: '--fullscreen "{rom}"', url: 'https://www.ppsspp.org', note: '' },
  { id: 'retroarch', name: 'RetroArch', for: ['ps1', 'psp', 'gc', 'wii'], status: 'mature', exe: ['retroarch.exe'], hint: ['retroarch'],
    args: '-f -L "{emudir}\\cores\\{core}_libretro.dll" "{rom}"', url: 'https://www.retroarch.com', note: 'Uses the core set on each console section.' }
];

// Tuning for the machine EchoForge is running on. Inputs come from the hardware probe.
// Ratings are honest: experimental cores stay experimental no matter how fast the PC is.
window.efTune = function (hw, consoleId) {
  const vram = hw.vramGB || 4, threads = hw.threads || 4, ram = hw.ramGB || 8;
  const nvidia = /nvidia|geforce|rtx|gtx/i.test(hw.gpu || '');
  const tier = vram >= 8 && threads >= 12 ? 'high' : vram >= 6 && threads >= 8 ? 'mid' : 'low';
  const scale = { high: 1, mid: 0.75, low: 0.5 }[tier];
  const c = window.EF_CONSOLES.find(x => x.id === consoleId);
  const notes = [];
  if (ram < c.ram + 6) notes.push(`${ram} GB RAM is tight for ${c.short}: close browsers and overlays before playing.`);
  const T = {
    ps5: { rating: 'Experimental', settings: [['Renderer', 'Vulkan'], ['Expectation', 'Boot/menus only — no PC can play PS5 games yet']] },
    xone: { rating: 'Experimental', settings: [['Expectation', 'Only a few titles launch']] },
    ps4: { rating: tier === 'low' ? 'Struggles' : 'Good (game-dependent)', settings: [
      ['Graphics API', 'Vulkan 1.3 (required)'], ['Internal resolution', tier === 'high' ? '1920×1080 (native)' : '1280×720'],
      ['Shader cache', 'On — keep it on your fastest NVMe drive'], ['Fullscreen', 'Borderless'], ['V-blank divider', '1']] },
    ps3: { rating: tier === 'low' ? 'Playable' : 'Great', settings: [
      ['PPU / SPU decoder', 'LLVM recompiler'], ['Preferred SPU threads', threads >= 12 ? 'Auto' : '2'],
      ['Renderer', 'Vulkan'], ['Resolution scale', tier === 'high' ? '150% (≈1620p, safe for 8 GB VRAM)' : '100%'],
      ['Shader mode', 'Async (multi-threaded)'], ['SPU block size', 'Mega'], ['Write color buffers', 'Only if a game needs it']] },
    x360: { rating: tier === 'low' ? 'Playable' : 'Great', settings: [
      ['GPU', nvidia ? 'D3D12' : 'Vulkan'], ['Resolution scale', tier === 'high' ? '2×2 (1440p)' : '1×1'],
      ['Readback resolve', 'Fast'], ['Mount cache', 'On'], ['V-sync', 'On']] },
    wii: { rating: 'Great', settings: [['Backend', nvidia ? 'Vulkan' : 'D3D12'], ['Internal resolution', `${Math.max(2, Math.round(4 * scale))}× native`], ['Shader compilation', 'Hybrid ubershaders'], ['Compile shaders before starting', 'Off']] },
    gc: { rating: 'Great', settings: [['Backend', nvidia ? 'Vulkan' : 'D3D12'], ['Internal resolution', `${Math.max(2, Math.round(4 * scale))}× native`], ['Shader compilation', 'Hybrid ubershaders']] },
    xbox: { rating: tier === 'low' ? 'Playable' : 'Great', settings: [['Renderer', 'Vulkan'], ['Resolution scale', tier === 'high' ? '3× (1440p)' : '2×'], ['Cache shaders to disk', 'On']] },
    ps2: { rating: 'Great', settings: [['Renderer', 'Vulkan'], ['Internal resolution', tier === 'high' ? '4× native (1440p)' : '3× native (1080p)'], ['EE cycle rate', '0 (default)'], ['Texture preloading', 'Full']] },
    ps1: { rating: 'Great', settings: [['Renderer', 'Vulkan'], ['Resolution scale', tier === 'high' ? '6×' : '4×'], ['PGXP geometry correction', 'On']] },
    psp: { rating: 'Great', settings: [['Backend', 'Vulkan'], ['Rendering resolution', tier === 'high' ? '5× PSP' : '3× PSP']] }
  };
  const t = T[consoleId] || { rating: 'Unknown', settings: [] };
  return { tier, rating: t.rating, settings: t.settings, notes };
};

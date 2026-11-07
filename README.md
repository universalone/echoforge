# EchoForge

**Next-gen emulation, reforged.** A launcher for PS5, Xbox One, PS4, PS3, Xbox 360, Xbox, Wii, PS2, GameCube, PS1 and PSP, with one library across every drive.

> **Early preview (v0.1).** Expect rough edges. It has mostly been used on one PC, and the installer isn't code-signed yet. PS5 and Xbox One support is experimental: those emulators boot only a few titles and most games won't play.

## Run it
```bash
npm install
npm start
```

## Build the installer
```bash
npm run dist
```
This writes `dist\EchoForge-Setup-<version>.exe`, an assisted installer: you choose the folder (default `%LOCALAPPDATA%\Programs\EchoForge`), and it adds Desktop and Start menu shortcuts. Settings and library live in `%APPDATA%\EchoForge`, so they carry over between the dev build and the installed app. The installer isn't code-signed yet, so Windows SmartScreen will warn the first time you run it.

## What's in it
- **Splash screen**: animated forge logo, ember particles and real loading progress.
- **Console sections** grouped Next-Gen / Current-Gen / HD Era / Classics. Each section has its own library, setup and "Tuned for your PC" tab.
- **Libraries on any drive**: several folders per console, labelled NVMe / SSD / USB HDD. Games on an unplugged drive show as offline instead of being deleted. Standard layout: `<ROM root>\<Console>` (Playstation, Playstation 2–5, Xbox, Xbox 360, Xbox One, GameCube, Wii, PSP). Change the root in Settings → Library, and **Create & add folders** sets up every console at once.
- **Game storage tiers**: whether a game needs an SSD depends on its console, never its size. PS4, PS5 and Xbox One games belong on the fast library (SSD/NVMe). PS3, Xbox 360 and older games belong on an optional storage library (a hard drive is faster than their original discs). Each game page says "Needs an SSD" or "No SSD needed". Your PC → Game storage lists the games on an SSD that don't need one, biggest first, with Show file and Move buttons, plus games on the wrong drive, which move with one click or all at once: copy, verify byte counts, then delete the original. Playtime, favorites and covers carry over.
- **Box art**: games without their own icon get a cover from the libretro thumbnails library (the one RetroArch uses), matched by No-Intro/Redump name with a USA-first fallback. PSP games without box art show the disc's own ICON0.PNG over its PIC1.PNG menu background, which is also used as the full-screen backdrop. Xbox 360 games can fall back to XboxUnity, off until you turn it on: EchoForge reads the title ID from the disc's `default.xex` and crops the front out of full wraparound scans. Covers are cached in `%APPDATA%\EchoForge\covers`, and Settings → Library can turn this off.
- **Import folder** (`app/inbox.js`): checks the folder you choose and reads each archive's or disc image's own data to tell PS1, PS2, PS3, PSP, Xbox, Xbox 360, GameCube and Wii discs and PS3/PS4 packages apart. Supported formats: .7z/.zip/.rar, ISO, CSO, CISO, RVZ and WBFS. **Add all** unpacks each game to its console's library on the right drive tier (or the other drive when space is short), checks every file's size, adds it with artwork and sends the archive to the Recycle Bin. PS3 discs become RPCS3 game folders, and encrypted dumps are refused. PS3 packages are installed through RPCS3, with a warning when the game needs a license file. DVD-video bonus discs are recognised as not games. Installers and shortcuts in the folder are never run. Needs 7-Zip.
- **Downloads drive** (`app/downloads.js`, off until you turn it on in Settings → Import): when the drive holding Windows' Downloads folder drops below 100 GB free (adjustable), EchoForge points Downloads at `D:\Downloads` (adjustable). It's the same per-user setting as Downloads → Properties → Location, so Edge, Chrome and other apps save new downloads straight to that drive after a restart. Files already downloaded aren't moved, and it won't switch to a drive that's low too or unplugged. While it's on, games you import follow the same limit: if their usual drive would drop below it, they go to the other library drive. Settings → Import can switch it back or turn it off. Free space is checked at start and every 10 minutes.
- **Shared games** (`app/share.js`): for moving your own games between your own PCs. Turn on sharing on one PC, then on another PC enter its name or address and the code, tick the games you want and press Install. Only those games are copied, each file is checksum-checked, and a stopped install picks up where it left off. Sharing is off by default, read-only, answers only private network addresses and runs only while EchoForge is open. Traffic isn't encrypted. Emulators can be copied the same way into `%LOCALAPPDATA%\Programs` and are linked automatically; saves, caches, firmware and games inside an emulator's folder stay behind, and nothing already on the other PC is replaced.
- **"Will it run?" badges** (`app/compat.js`): PS3 games are looked up on RPCS3's compatibility list and Xbox 360 games on Xenia Canary's tester tracker, by disc title ID only. Each cover shows Playable / Runs with issues / Won't play yet / Not tested yet, and the game details show the test date, a link to the tester report and known tweaks. EchoForge asks once before launching a game that's reported not to work. Results are cached for a week (`compat-cache.json`), and the lookups can be turned off in Settings → Library.
- **Collections**: series are found from titles across every console (Star Wars, SOCOM, Spider-Man, Tony Hawk's and so on). Games that share their opening words are grouped. A generic one-word start like "Dead" needs a second shared word, and "Escape Dead Island" still joins Dead Island. They appear on a Collections page, a Home shelf and as a library filter. In a game's details, type a collection name to move it, or "-" to keep it out of collections.
- **Save backups** (`app/backup.js`): finds each emulator's save folders (portable or Documents installs) and copies them into dated snapshots under `<backup folder>\<emulator>\`:
  - **Sources**: RPCS3 saves, trophies and licenses; PCSX2 and DuckStation memory cards and states; PPSSPP SAVEDATA; Dolphin GC, Wii and states; only the Xenia save folders (not DLC or updates); xemu's HDD image and EEPROM; shadPS4 and RetroArch saves.
  - **When**: after every game session and weekly. A backup is skipped when nothing changed.
  - **Retention**: keeps the newest 10 per emulator (adjustable), and older snapshots go to the Recycle Bin.
  - **Restore**: refuses while the emulator is running and backs up the current saves first.
  - **Location**: defaults to `<storage drive>\EchoForge Backups`.
- **Game page**: clicking a game opens a full-screen page.
  - **Backdrop**: the game's own art, in this order: the PS3/PS4/PSP `PIC1.PNG` background read from the disc, an in-game screenshot or title screen from libretro's `Named_Snaps` / `Named_Titles`, or a blurred cover.
  - **Layout**: a large title, the "will it run?" result, its collection, a screenshot strip and "More in <collection>".
  - **Manage**: rename, cover, collection, emulator, launch options, file, hide, remove and send to the Recycle Bin. The bin button shows the files and size first, keeps saves, refuses a folder that also holds another game, and refuses any game too big for that drive's bin, because Windows would delete it for good.
  - **Titles**: shown like the box ("Simpsons Game, The" becomes "The Simpsons Game", "Star Wars - Battlefront II" becomes "Star Wars: Battlefront II").
  - **Cards**: tilt toward the pointer and catch a sweep of light (full motion only).
- **Smart scanning**: reads PS4/PS5/PS3 `PARAM.SFO` / `param.json` for real titles and IDs and uses each game's own icon as cover art. Cleans No-Intro/Redump names.
- **Foolproof launching**: every console shows Emulator / Firmware / Games checks. Play is never a dead end: a "needs a quick fix" dialog sends you straight to the fix. Also: low-RAM warning, and a plain-English message when an emulator closes right away.
- **Firmware & BIOS checker**: per-console folders, MD5 verification (e.g. Xbox MCPX), "installed in emulator" ticks, links to official sources. EchoForge never downloads or copies firmware.
- **Emulator updates** (`app/emu-updates.js`): KytyPS5 and shadPS4 are checked once a day against their official GitHub releases (Settings → General can turn this off). Only Windows builds with a SHA-256 published by GitHub are used, and shadPS4's daily pre-releases are skipped for its stable releases. **Update** downloads the build, checks the checksum, backs up the files it replaces and copies the new ones over, so settings and saves in the emulator's folder stay. **Roll back** puts the previous version back; the 2 newest backups are kept in `%LOCALAPPDATA%\EchoForge\emulator-backups`. Nothing updates while that emulator is running, and nothing installs until you press Update. Needs 7-Zip.
- **Hardware-aware**: detects GPU/VRAM, CPU threads, RAM and drive types, and recommends emulator settings for this machine. Game mode minimizes the launcher, pauses its effects and raises emulator priority.
- **Controller navigation** (A/B/X/Y, LB/RB sections), **Big Picture** (F10) and full keyboard support.
- **Settings**: general, appearance (6 accents, dark/OLED/light, neon effects: breathe, pulse, chase, flicker, color cycle or steady, with adjustable speed, the highlighted game as a blurred full-screen background, cover size and shape, UI scale), library, launching & performance, controller, sound, Big Picture, accessibility, backup/restore.

## Layout
```
app/main.js        Electron main: windows, storage, scanning, SFO parsing, firmware checks, hardware probe, launching
app/emu-updates.js Emulator updates from official GitHub releases: check, verified download, backup, roll back
app/preload.js     Safe bridge to the UI
app/splash.html    Splash screen
app/index.html     Shell     app/styles.css  Design system     app/renderer.js  UI
app/data.js        Console + emulator catalog and per-PC tuning rules
app/assets/        logo.svg, icon.png, icon.ico
tools/             make_icon.py (icon from the logo), make_test_library.py (fake library for testing), build_shadps4.cmd / build_rpcs3.cmd (build from source), install_emulators.ps1 (Xenia Canary, xemu, DuckStation, Dolphin, PPSSPP from official releases)
test/              emu_updates_test.js (emulator updates against a fake release feed: npm test)
docs/RESEARCH.md   Emulator research, firmware table, build toolchains, roadmap
```

## Testing without touching your real profile
```powershell
$env:EF_PROFILE="$env:TEMP\efprofile"; npm start
```
`EF_SNAP=<dir>` saves screenshots of the splash and main window, then quits. It only works when running from source.

## Toolchain on this PC (for building cores)
Visual Studio 2022 (C++ + Clang), CMake, Ninja, LLVM, Vulkan SDK, 7-Zip, Git, Python, Node. Add LLVM and 7-Zip to your PATH:
```powershell
[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path','User') + ';C:\Program Files\LLVM\bin;C:\Program Files\7-Zip', 'User')
```
Qt 6.8.2 (MSVC 2022, with Multimedia) is installed at `C:\Qt\6.8.2\msvc2022_64`. Pass it to CMake with `-DCMAKE_PREFIX_PATH=C:\Qt\6.8.2\msvc2022_64`, or set `QTDIR` to it for RPCS3. See docs/RESEARCH.md §4 for the full build recipe.

**shadPS4 from source:** run `tools\build_shadps4.cmd`. It clones or updates `%USERPROFILE%\src\shadPS4`, builds it, and installs `shadps4.exe` to `%LOCALAPPDATA%\Programs\shadPS4`. EchoForge's **Emulators → Auto-detect** then picks it up.

**RPCS3 from source:** run `tools\build_rpcs3.cmd` (needs Qt 6.12.0 at `C:\Qt\6.12.0\msvc2022_64`). The first build takes about 75 minutes because it builds LLVM; after that it's incremental. It installs to `%LOCALAPPDATA%\Programs\RPCS3` and never overwrites RPCS3's game data folders (dev_hdd0 etc.).

## License
GPL-3.0-or-later. See [LICENSE](LICENSE).

## Legal
EchoForge contains no games, firmware, BIOS files or keys, doesn't download them and doesn't decrypt or bypass copy protection. Use only games and system files you made yourself from discs, cartridges and hardware you own, where your local law allows it. EchoForge isn't affiliated with or endorsed by Sony, Microsoft, Nintendo or Sega; their names appear only to describe compatibility. Emulators are separate projects under their own licenses.

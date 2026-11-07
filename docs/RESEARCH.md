# EchoForge — Emulation Research & Roadmap

_Compiled 2026-11-01. The emulator landscape moves quickly, so recheck each project's GitHub before relying on a status below._

## 1. Where next-gen emulation stands (late 2026)

| Console | Leading open-source project | State | Approach |
|---|---|---|---|
| **PlayStation 5** | [KytyPS5](https://github.com/KytyPS5), SharpEmu (official repos listed in [RPCS3's post](https://x.com/rpcs3/status/2078143991363571972)) | **Boots a few titles, nothing playable** | HLE + native x86-64 execution |
| **Xbox One** | [WinDurango](https://github.com/WinDurango) (translation layer) | **A few titles launch** (Minecraft XB1 Ed., Sonic Mania title screen) | Translates the Windows-based game OS to desktop Windows |
| **PlayStation 4** | [shadPS4](https://github.com/shadps4-emu/shadPS4) | **Early but real**: ~117+ playable on Windows, Bloodborne runs | HLE + native x86-64, Vulkan 1.3 |
| PlayStation 3 | [RPCS3](https://rpcs3.net) | Mature: thousands playable | LLVM recompiler for Cell PPU/SPU |
| Xbox 360 | [Xenia Canary](https://github.com/xenia-canary/xenia-canary) | Mature | PowerPC JIT, D3D12/Vulkan |
| Xbox (original) | [xemu](https://xemu.app) | Good | Low-level (QEMU-based) |

**Avoid fake emulator sites.** Fake "PS5 emulator" downloads are a known malware vector in 2026, including fake GitHub repos. EchoForge only links to official project pages.

## 2. What it takes to build a PS4 / PS5 / Xbox One emulator

All three consoles use **x86-64 AMD CPUs** (Jaguar on PS4/XB1, Zen 2 on PS5) and **AMD GPUs** (GCN on PS4/XB1, RDNA 2 on PS5). That changes the problem compared with older consoles:

1. **CPU: run natively, don't emulate.** Game code is already x86-64, so a PC can execute it directly (shadPS4's approach). The hard part is everything the code *calls*.
2. **Loader.** Parse the console executable format (PS4/PS5: SELF/ELF with Sony extensions; XB1: PE in an appx-like package), relocate it, resolve imports by NID/name, set up TLS, and patch syscalls.
3. **OS / kernel HLE.** PS4 and PS5 run Orbis OS (FreeBSD-derived) and expose hundreds of system libraries (`libkernel`, `libSceGnmDriver`, `libSceAudioOut`, `libScePad`, `libSceSaveData`…). Each one needs reimplementing (HLE), or the real `.sprx` module is loaded from a dump of your own console (shadPS4's `sys_modules`). Xbox One games run in a Windows-based "Era" VM, so a Win32 translation layer (WinDurango) works better than a classic emulator.
4. **GPU, the largest piece of work.** Decode the PM4 command buffers the game submits, translate GCN/RDNA shader binaries into **SPIR-V** (Vulkan), emulate the GPU memory model (tiling, render targets, unified memory) and cache translated shaders. Your RTX 4060 supports Vulkan 1.3, which shadPS4 requires.
5. **Memory.** Map the console's unified 8 GB (PS4) / 16 GB (PS5) address space onto the host. That is a big reason 16 GB of PC RAM is the practical minimum.
6. **Audio, input, storage and networking:** AJM/Ngs2 audio decoding, controller mapping, save data, trophies (PS), and file-system virtualisation for `/app0`, `/savedata`, etc.
7. **Tooling:** a debugger, logging, shader dumps, and a compatibility database. Plan for these from day one.

**Realistic path for EchoForge:** don't write a PS4 core from scratch. Build shadPS4 from source on this PC, contribute to it and learn its architecture, then decide where our own work adds value. PS5 work should follow KytyPS5/SharpEmu, which already share PS4-era infrastructure.

## 3. Firmware / BIOS each core needs

EchoForge never ships or downloads these. Dump them from consoles you own; the Firmware page checks them.

| Console | Files | Legal source |
|---|---|---|
| PS5 | System libraries | Dump from your PS5 |
| PS4 | `sys_modules\*.sprx` (optional, some games need them) | Dump from your PS4 |
| PS3 | `PS3UPDAT.PUP` | **Free from [Sony's site](https://www.playstation.com/en-us/support/hardware/ps3/system-software/)**; install via RPCS3 → File → Install Firmware |
| Xbox 360 | none | — |
| Xbox | `mcpx_1.0.bin` (MD5 `d49c52a4102f6df7bcf8d0617ac475ed`), flash BIOS, `xbox_hdd.qcow2` | Dump from your Xbox; [xemu docs](https://xemu.app/docs/required-files/) link a clean HDD image |
| PS2 | `scph*.bin` | Dump with the PCSX2 BIOS dumper |
| PS1 | `scph*.bin` (DuckStation) | Dump from your PS1; RetroArch's PCSX ReARMed can run without one |
| GC / Wii / PSP | none | — |

## 4. Building the cores from source on this PC

| Core | Toolchain (per official docs) | Status on this PC |
|---|---|---|
| shadPS4 | VS 2022 + Clang component, CMake, Ninja, Qt 6.8 (msvc2022_64) for the GUI; SDL build needs no Qt | ✅ ready |
| RPCS3 | VS 2022 (C++20), Qt 6.7+, Python 3.6+ | ✅ ready (`QTDIR=C:\Qt\6.8.2\msvc2022_64`) |
| Xenia Canary | VS 2022 + Windows 11 SDK, Python 3.9+ 64-bit, Git (`xb setup` / `xb build`) | ✅ ready |
| KytyPS5 | C++ / CMake (Windows & Linux) | ✅ ready (check its README) |

**Installed on 2026-11-01:** Visual Studio Community 2022 17.14 (Desktop C++, Clang/LLVM toolset, CMake tools, Windows 11 SDK), CMake 4.4.4, Ninja 1.13.2, LLVM 23.1.4, 7-Zip, Vulkan SDK 1.4.363. **Already present:** Git 2.55, Node 24.18, Python 3.12, .NET, JDK 17.

**Qt 6.8.2 (msvc2022_64) + qtmultimedia + qtimageformats** installed at `C:\Qt\6.8.2\msvc2022_64` with aqtinstall (no Qt account). Verified by building and running a Qt Widgets/Multimedia/Network test app with both MSVC and clang-cl through CMake + Ninja.

**Build recipe:** open "x64 Native Tools Command Prompt for VS 2022", then `cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_COMPILER=clang-cl -DCMAKE_C_COMPILER=clang-cl -DCMAKE_PREFIX_PATH=C:\Qt\6.8.2\msvc2022_64` and `cmake --build build`. Deploy Qt DLLs with `C:\Qt\6.8.2\msvc2022_64\bin\windeployqt6.exe <exe>`.

**shadPS4 built from source (2026-11-02):** main @ `2183807` (v0.21.1 WIP), LLVM 23.1.4 clang-cl + Ninja, 2,484 build steps, about 12 minutes on the Ryzen 5 5500. Re-run `tools\build_shadps4.cmd` to pull and rebuild incrementally. It installs to `%LOCALAPPDATA%\Programs\shadPS4\shadps4.exe`, where EchoForge auto-detects it.
- The Qt GUI now lives in a separate repo (shadps4-qtlauncher), so the core needs no Qt. EchoForge is the launcher.
- **Gotcha:** LLVM 23 ships its own `endian.h`, so LibreSSL's `HAVE_ENDIAN_H` check passes and its Windows `be32toh`/`htobe32` shims disappear. Fix: pass `-DHAVE_ENDIAN_H=0` (no source changes).
- Keep `cmd` script paths short: very long paths make `cmd /c` fail with "cannot find the path".
- CLI: `shadps4.exe -g <eboot.bin|folder|ID>`, plus `-f true|false` (fullscreen), `-b` (its own Big Picture), `-p <patch>`, `--show-fps`, `--add-game-folder`. Runtime needs only system DLLs and the VC++ runtime.

**RPCS3 built from source (2026-11-02):** master @ `a2c2ca2`, MSVC + Ninja Multi-Config with the bundled LLVM, 4,905 build steps, about 75 minutes the first time (mostly LLVM; later rebuilds are incremental). Uses the same CMake flags as RPCS3's `scripts\win_build.ps1` but runs unattended: `tools\build_rpcs3.cmd`. It installs to `%LOCALAPPDATA%\Programs\RPCS3` (155 MB with Qt DLLs via windeployqt6), where EchoForge auto-detects it.
- RPCS3 needs **Qt 6.12.0**, installed at `C:\Qt\6.12.0\msvc2022_64`. aqtinstall 3.3.0 can't install 6.12 because Qt now splits the repo per arch (`qt6_6120/qt6_6120_msvc2022_64/`). I fetched qtbase/qtsvg/qtdeclarative/qttools/qttranslations + qtmultimedia + qtimageformats from download.qt.io directly, verified each against its `.sha1`, extracted with 7-Zip (the new archives have no `6.12.0\msvc2022_64` prefix), and added `bin\qt.conf`.
- Built with Vulkan SDK 1.4.363 although RPCS3 lists 1.4.341.1. It compiled fine; recheck if Vulkan issues show up.
- CLI: `rpcs3.exe --no-gui [--fullscreen] <EBOOT.BIN|game folder>`, plus `--big-picture`, `--headless`, `--user-id`.

**Still to do:** add `C:\Program Files\LLVM\bin` and `C:\Program Files\7-Zip` to PATH (optional; the VS prompt already has clang-cl).

## 5. Roadmap

- **Phase 0 (done):** EchoForge launcher: console sections, libraries on any drive, firmware checks, hardware tuning, controller navigation, splash screen and branding.
- **Phase 1:** Install shadPS4, RPCS3, Xenia Canary and xemu from their official pages. Link them, dump your firmware and play-test through EchoForge.
- **Phase 2:** Build shadPS4 and Xenia Canary from source with the toolchain above. Add an EchoForge "Cores" manager that tracks builds and versions.
- **Phase 3:** Launcher extras: per-emulator config writers (apply the tuned settings automatically), box-art scraping, shader-cache relocation to NVMe, Big Picture polish, installer (electron-builder).
- **Phase 4:** Contribute to shadPS4 / KytyPS5 (GPU and HLE libraries) and decide whether EchoForge ships its own core.

## Sources
- shadPS4 Windows build guide: https://github.com/shadps4-emu/shadPS4/blob/main/documents/building-windows.md
- PS5 emulation news: https://videocardz.com/newz/ps5-emulation-reaches-new-milestone-as-two-major-projects-become-community-driven
- Xbox One: https://emulation.gametechwiki.com/index.php/Xbox_One_emulators
- xemu required files: https://xemu.app/docs/required-files · https://github.com/dragoonDorise/EmuDeck/wiki/Xemu · https://github.com/xqemu/xqemu.com/blob/master/docs/getting-started.md
- RPCS3 build: https://github.com/RPCS3/rpcs3/blob/master/BUILDING.md
- Xenia build (mirrored docs): https://github.com/JoelLinn/xenia/blob/master/docs/building.md

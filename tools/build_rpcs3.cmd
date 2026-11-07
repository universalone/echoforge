@echo off
rem Builds RPCS3 from source (MSVC + Ninja Multi-Config, bundled LLVM, Qt 6.12) and installs it where EchoForge auto-detects it.
rem Same CMake flags as RPCS3's scripts\win_build.ps1, minus its interactive prompts.
rem   Source:  %USERPROFILE%\src\rpcs3   (cloned on first run)
rem   Install: %LOCALAPPDATA%\Programs\RPCS3\rpcs3.exe
rem   Log:     %USERPROFILE%\src\rpcs3-build.log
rem Run again any time to pull the latest master and rebuild incrementally.
setlocal
set "SRC=%USERPROFILE%\src\rpcs3"
set "OUT=%LOCALAPPDATA%\Programs\RPCS3"
set "Qt6_ROOT=C:\Qt\6.12.0\msvc2022_64"
set "PATH=C:\Program Files (x86)\Microsoft Visual Studio\Installer;%PATH%"
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul || exit /b 1

if not exist "%SRC%\.git" (
  git -c core.longpaths=true clone --depth 1 --recurse-submodules --shallow-submodules https://github.com/RPCS3/rpcs3.git "%SRC%" || exit /b 1
  git -C "%SRC%" config core.longpaths true
) else (
  git -C "%SRC%" pull --ff-only && git -C "%SRC%" submodule update --init --recursive --depth 1 || exit /b 1
)
cd /d "%SRC%" || exit /b 1

rem RPCS3's script wipes the SDL3 build folder each run to avoid a CMake 4.x export() conflict.
if exist build\3rdparty\libsdl-org rmdir /s /q build\3rdparty\libsdl-org
if not exist build\CMakeCache.txt (
  cmake -S . -B build -G "Ninja Multi-Config" -DBUILD_LLVM=ON -DUSE_SYSTEM_CURL=OFF -DUSE_SYSTEM_ZLIB=OFF -DUSE_SYSTEM_LIBPNG=OFF -DUSE_SYSTEM_SDL=OFF -DUSE_VULKAN=ON "-DQt6_ROOT=%Qt6_ROOT%" "-DCMAKE_PREFIX_PATH=%Qt6_ROOT%" || exit /b 2
)
cmake --build build --config Release --parallel %NUMBER_OF_PROCESSORS% || exit /b 3

rem Copy the build plus its Qt runtime into the install folder (user data like dev_hdd0 lives there too, so never wipe it).
if not exist "%OUT%" mkdir "%OUT%"
robocopy build\bin "%OUT%" /e /njh /njs /nfl /ndl /xd dev_hdd0 dev_hdd1 dev_flash dev_usb000 config >nul
if errorlevel 8 exit /b 4
"%Qt6_ROOT%\bin\windeployqt6.exe" --release --no-translations --no-compiler-runtime "%OUT%\rpcs3.exe" >nul || exit /b 5
git -C "%SRC%" log -1 --format="%%h %%cs" > "%OUT%\BUILD_INFO.txt"
echo BUILD_OK %OUT%\rpcs3.exe

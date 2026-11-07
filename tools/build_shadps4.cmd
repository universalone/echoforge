@echo off
rem Builds shadPS4 (SDL core) from source with LLVM clang-cl + Ninja and installs it where EchoForge auto-detects it.
rem   Source:  %USERPROFILE%\src\shadPS4   (cloned on first run)
rem   Install: %LOCALAPPDATA%\Programs\shadPS4\shadps4.exe
rem Run again any time to pull the latest main and rebuild incrementally.
setlocal
set "SRC=%USERPROFILE%\src\shadPS4"
set "OUT=%LOCALAPPDATA%\Programs\shadPS4"
set "PATH=C:\Program Files (x86)\Microsoft Visual Studio\Installer;%PATH%"
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul || exit /b 1
set "PATH=C:\Program Files\LLVM\bin;%PATH%"

if not exist "%SRC%\.git" (
  git -c core.longpaths=true clone --depth 1 --recursive --shallow-submodules https://github.com/shadps4-emu/shadPS4 "%SRC%" || exit /b 1
  git -C "%SRC%" config core.longpaths true
) else (
  git -C "%SRC%" pull --ff-only && git -C "%SRC%" submodule update --init --recursive --depth 1 || exit /b 1
)
cd /d "%SRC%" || exit /b 1

rem HAVE_ENDIAN_H=0: LLVM 23 ships its own endian.h, which hides LibreSSL's Windows byte-order shims
cmake -S . -B Build\x64-Clang-Release -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_C_COMPILER=clang-cl -DCMAKE_CXX_COMPILER=clang-cl -DHAVE_ENDIAN_H=0 || exit /b 2
cmake --build Build\x64-Clang-Release --parallel %NUMBER_OF_PROCESSORS% || exit /b 3

if not exist "%OUT%" mkdir "%OUT%"
copy /y Build\x64-Clang-Release\shadps4.exe "%OUT%\" >nul || exit /b 4
git -C "%SRC%" log -1 --format="%%h %%cs" > "%OUT%\BUILD_INFO.txt"
echo BUILD_OK %OUT%\shadps4.exe

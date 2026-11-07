# Installs the prebuilt emulators EchoForge uses into %LOCALAPPDATA%\Programs\<Name>, in portable mode.
# Official sources only. GitHub releases are checked against GitHub's published SHA-256; the others by Authenticode signature.
# Re-run any time to update: existing settings/saves inside each folder are kept (archives only add/replace program files).
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Z = 'C:\Program Files\7-Zip\7z.exe'
$root = Join-Path $env:LOCALAPPDATA 'Programs'
$dl = Join-Path $env:TEMP 'echoforge-emus'
New-Item -ItemType Directory -Force $dl | Out-Null

$emus = @(
  @{ name = 'Xenia Canary'; repo = 'xenia-canary/xenia-canary-releases'; asset = '^xenia_canary_windows.*\.zip$'; exe = 'xenia_canary.exe'; portable = 'portable.txt' },
  @{ name = 'xemu';         repo = 'xemu-project/xemu';                  asset = '^xemu-win-x86_64-release\.zip$'; exe = 'xemu.exe'; portable = 'xemu.toml' },
  @{ name = 'DuckStation';  repo = 'stenzek/duckstation';                asset = '^duckstation-windows-x64-release\.zip$'; exe = 'duckstation-qt-x64-ReleaseLTCG.exe'; portable = 'portable.txt' },
  @{ name = 'Dolphin';      url  = (Invoke-RestMethod 'https://dolphin-emu.org/update/latest/beta' -UserAgent 'Dolphin/2509').artifacts.Where({ $_.system -eq 'Windows x64' })[0].url; exe = 'Dolphin.exe'; portable = 'portable.txt' },
  @{ name = 'PPSSPP';       page = 'https://www.ppsspp.org/download/'; exe = 'PPSSPPWindows64.exe'; portable = $null }  # no installed.txt = data stays in .\memstick
)

foreach ($e in $emus) {
  $sha = $null
  if ($e.repo) {
    $rel = Invoke-RestMethod "https://api.github.com/repos/$($e.repo)/releases/latest" -Headers @{ 'User-Agent' = 'echoforge' }
    $a = $rel.assets | Where-Object { $_.name -match $e.asset } | Select-Object -First 1
    $url = $a.browser_download_url; $sha = ($a.digest -replace '^sha256:', ''); $ver = $rel.tag_name
  } elseif ($e.page) {
    $html = (Invoke-WebRequest $e.page -UseBasicParsing -UserAgent 'Mozilla/5.0').Content
    $url = ([regex]::Matches($html, 'https://www\.ppsspp\.org/files/[0-9_]+/ppsspp_win\.zip') | Select-Object -First 1).Value
    $ver = ($url -split '/')[-2]
  } else { $url = $e.url; $ver = ($url -split '/')[-2] }

  $file = Join-Path $dl ($url -split '/')[-1]
  Invoke-WebRequest $url -OutFile $file -UseBasicParsing -UserAgent 'Mozilla/5.0'
  if ($sha) { $h = (Get-FileHash $file -Algorithm SHA256).Hash.ToLower(); if ($h -ne $sha) { throw "$($e.name): SHA256 mismatch ($h)" } }

  $stage = Join-Path $dl ("stage-" + $e.name); Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
  & $Z x $file "-o$stage" -y -bso0 -bsp0; if ($LASTEXITCODE) { throw "$($e.name): extract failed" }
  # Some archives wrap everything in one top folder (Dolphin-x64\...): install from wherever the exe is.
  $exe = Get-ChildItem $stage -Recurse -Filter $e.exe | Select-Object -First 1
  if (-not $exe) { throw "$($e.name): $($e.exe) not found in archive" }
  $dest = Join-Path $root $e.name; New-Item -ItemType Directory -Force $dest | Out-Null
  Copy-Item (Join-Path $exe.DirectoryName '*') $dest -Recurse -Force
  if ($e.portable -and -not (Test-Path (Join-Path $dest $e.portable))) { New-Item -ItemType File (Join-Path $dest $e.portable) | Out-Null }
  $sig = Get-AuthenticodeSignature (Join-Path $dest $e.exe)
  $check = if ($sha) { 'sha256 OK' } else { "signature $($sig.Status) ($($sig.SignerCertificate.Subject -replace ',.*$',''))" }
  "{0,-13} {1,-10} {2}  -> {3}" -f $e.name, $ver, $check, (Join-Path $dest $e.exe)
  Set-Content (Join-Path $dest 'ECHOFORGE_SOURCE.txt') "$url`r`n$ver`r`n$(Get-Date -Format s)"
  Remove-Item $stage, $file -Recurse -Force
}
Remove-Item $dl -Recurse -Force -ErrorAction SilentlyContinue

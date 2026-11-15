# EchoForge: keeps a game's window on the game screen (the middle of three screens) as a borderless window filling it.
# Watches the process and the processes it starts for -Seconds after launch, because emulators open and resize their
# window at different moments while a game boots. Only the largest visible window is moved; dialog boxes (an
# emulator's messages and errors) are left alone. Exits when the game does.
param(
  [Parameter(Mandatory = $true)][int]$ProcId,
  [Parameter(Mandatory = $true)][int]$X, [Parameter(Mandatory = $true)][int]$Y,
  [Parameter(Mandatory = $true)][int]$W, [Parameter(Mandatory = $true)][int]$H,
  [int]$Seconds = 60
)
Add-Type -TypeDefinition @"
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;
public static class EfPlace {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] static extern IntPtr GetLong(IntPtr h, int i);
  [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] static extern IntPtr SetLong(IntPtr h, int i, IntPtr v);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hh, uint f);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr ctx);
  // Real pixels: without this a script host that isn't DPI-aware reads and sets scaled positions and sizes, and the
  // window ends up a little off. Per thread, so it works however PowerShell itself was started.
  static void Aware() { try { SetThreadDpiAwarenessContext(new IntPtr(-4)); } catch { } } // PER_MONITOR_AWARE_V2
  const long WS_CAPTION = 0x00C00000, WS_THICKFRAME = 0x00040000, WS_SYSMENU = 0x00080000, WS_MINIMIZEBOX = 0x00020000, WS_MAXIMIZEBOX = 0x00010000, WS_MAXIMIZE = 0x01000000;
  // The largest visible top-level window of these processes that isn't a dialog box.
  public static IntPtr Largest(HashSet<uint> pids) {
    Aware(); IntPtr best = IntPtr.Zero; long area = 0;
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (!pids.Contains(pid) || !IsWindowVisible(h) || GetWindow(h, 4) != IntPtr.Zero) return true; // 4 = GW_OWNER
      var c = new StringBuilder(64); GetClassName(h, c, 64); if (c.ToString() == "#32770") return true;
      RECT r; GetWindowRect(h, out r); long a = (long)(r.R - r.L) * (r.B - r.T);
      if (r.R - r.L >= 320 && r.B - r.T >= 200 && a > area) { area = a; best = h; }
      return true;
    }, IntPtr.Zero);
    return best;
  }
  // Where the window is: "x,y,w,h".
  public static string Where(IntPtr h) { Aware(); RECT r; GetWindowRect(h, out r); return r.L + "," + r.T + "," + (r.R - r.L) + "," + (r.B - r.T); }
  // Borderless and on the rectangle (a few pixels either way counts: some windows round their own size); returns true
  // when something had to change. size: false only fixes the border and position, for a window that resists a size.
  public static bool Place(IntPtr h, int x, int y, int w, int hh, bool size) {
    Aware(); bool changed = false;
    long s = GetLong(h, -16).ToInt64(), want = s & ~(WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_MAXIMIZE);
    if (want != s) { SetLong(h, -16, new IntPtr(want)); changed = true; }
    RECT r; GetWindowRect(h, out r);
    bool off = Math.Abs(r.L - x) > 2 || Math.Abs(r.T - y) > 2 || (size && (Math.Abs(r.R - r.L - w) > 24 || Math.Abs(r.B - r.T - hh) > 24));
    if (changed || off) {
      SetWindowPos(h, IntPtr.Zero, x, y, w, hh, 0x0020 | 0x0040 | 0x0200); // FRAMECHANGED | SHOWWINDOW | NOOWNERZORDER
      changed = true;
    }
    return changed;
  }
}
"@
[EfPlace]::SetProcessDPIAware() | Out-Null
$resist = @{}; $last = @{}
$end = (Get-Date).AddSeconds($Seconds); $pids = New-Object 'System.Collections.Generic.HashSet[uint32]'; $nextScan = Get-Date
while ((Get-Date) -lt $end) {
  if (-not (Get-Process -Id $ProcId -ErrorAction SilentlyContinue)) { break }
  if ((Get-Date) -ge $nextScan) { # the game's process and every process it started
    $pids.Clear(); [void]$pids.Add([uint32]$ProcId); $all = Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId
    do { $n = $pids.Count; foreach ($p in $all) { if ($pids.Contains([uint32]$p.ParentProcessId)) { [void]$pids.Add([uint32]$p.ProcessId) } } } while ($pids.Count -gt $n)
    $nextScan = (Get-Date).AddSeconds(3)
  }
  # $win, not $h: PowerShell names ignore case, so $h would be the -H height parameter.
  $win = [EfPlace]::Largest($pids)
  if ($win -ne [IntPtr]::Zero) {
    # A window that comes back to the same wrong size after being resized keeps that size (no tug-of-war, no flicker);
    # it's still kept borderless and in place, and resized again if it moves or changes size by itself.
    $before = [EfPlace]::Where($win)
    if ($resist[$win] -lt 4 -or $before -ne $last[$win]) { if ([EfPlace]::Place($win, $X, $Y, $W, $H, $true)) { "placed $win"; $after = [EfPlace]::Where($win); if ($after -eq $last[$win]) { $resist[$win]++ } else { $resist[$win] = 0 }; $last[$win] = $after } }
    elseif ([EfPlace]::Place($win, $X, $Y, $W, $H, $false)) { "kept $win in place" }
  }
  Start-Sleep -Milliseconds 400
}

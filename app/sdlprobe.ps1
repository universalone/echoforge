# EchoForge: lists the controllers SDL3 sees, with the counts RPCS3 uses to recognise a racing wheel
# (vendor, product, axes, hats, buttons). Read only. Needs an SDL3.dll, e.g. the one that comes with PCSX2.
param([Parameter(Mandatory = $true)][string]$SdlDir)
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class EfSdl {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern bool SetDllDirectory(string p);
  [DllImport("SDL3.dll")] public static extern bool SDL_Init(uint f);
  [DllImport("SDL3.dll")] public static extern void SDL_Quit();
  [DllImport("SDL3.dll")] public static extern IntPtr SDL_GetJoysticks(out int n);
  [DllImport("SDL3.dll")] public static extern IntPtr SDL_OpenJoystick(uint id);
  [DllImport("SDL3.dll")] public static extern ushort SDL_GetJoystickVendor(IntPtr j);
  [DllImport("SDL3.dll")] public static extern ushort SDL_GetJoystickProduct(IntPtr j);
  [DllImport("SDL3.dll")] public static extern int SDL_GetNumJoystickAxes(IntPtr j);
  [DllImport("SDL3.dll")] public static extern int SDL_GetNumJoystickHats(IntPtr j);
  [DllImport("SDL3.dll")] public static extern int SDL_GetNumJoystickButtons(IntPtr j);
}
"@
[EfSdl]::SetDllDirectory($SdlDir) | Out-Null
if (-not [EfSdl]::SDL_Init(0x200)) { "error init"; exit 1 }
$n = 0; $p = [EfSdl]::SDL_GetJoysticks([ref]$n)
for ($i = 0; $i -lt $n; $i++) {
  $j = [EfSdl]::SDL_OpenJoystick([uint32][Runtime.InteropServices.Marshal]::ReadInt32($p, $i * 4))
  if ($j -eq [IntPtr]::Zero) { continue }
  "joy {0:x4} {1:x4} {2} {3} {4}" -f [EfSdl]::SDL_GetJoystickVendor($j), [EfSdl]::SDL_GetJoystickProduct($j), [EfSdl]::SDL_GetNumJoystickAxes($j), [EfSdl]::SDL_GetNumJoystickHats($j), [EfSdl]::SDL_GetNumJoystickButtons($j)
}
[EfSdl]::SDL_Quit()

'use strict';
// Xbox One games through WinDurango: there is no emulator program. The user patches each game with WinDurango's files
// and registers it (Add-AppxPackage -Register .\AppxManifest.xml), so the game runs as an installed Windows app.
// EchoForge reads the game's AppxManifest.xml, finds that registered package and starts it, then watches its process
// so play time and the exit are still recorded. Nothing here registers packages, copies files or changes settings.
const fsp = require('fs').promises;
const path = require('path');
const { execFile, spawn } = require('child_process');

// Package names are letters, digits, dots and dashes; anything else is refused before it reaches PowerShell.
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9.\-]{1,99}$/;

async function readManifest(file) {
  const x = await fsp.readFile(file, 'utf8');
  const attr = (tag, name) => { const t = (x.match(new RegExp(`<${tag}\\b[^>]*>`, 'i')) || [''])[0]; return (t.match(new RegExp(`\\b${name}="([^"]*)"`, 'i')) || [])[1] || ''; };
  const display = (x.match(/<DisplayName>([^<]+)<\/DisplayName>/i) || [])[1] || '';
  return { name: attr('Identity', 'Name'), publisher: attr('Identity', 'Publisher'), appId: attr('Application', 'Id'), exe: attr('Application', 'Executable'), title: display.startsWith('ms-resource') ? '' : display };
}

// What Windows needs to start an installed app: shell:AppsFolder\<PackageFamilyName>!<AppId>
const launchTarget = (familyName, appId) => `shell:AppsFolder\\${familyName}!${appId}`;

const ps = cmd => new Promise(ok => execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', cmd], { windowsHide: true, timeout: 20000 }, (err, out) => ok(err ? '' : String(out).trim())));

// The registered package for this game, or null when WinDurango's install step hasn't been done.
async function findPackage(name) {
  if (!SAFE_NAME.test(name || '')) return null;
  const out = await ps(`Get-AppxPackage -Name '${name}' | Select-Object -First 1 PackageFamilyName, InstallLocation | ConvertTo-Json -Compress`);
  try { const p = JSON.parse(out); return p && p.PackageFamilyName ? { familyName: p.PackageFamilyName, installLocation: p.InstallLocation || '' } : null; } catch { return null; }
}

// The game's running process: its exe from the manifest, running from the package's folder.
async function findProcess(pkg, exe) {
  const base = path.basename(exe || '', path.extname(exe || ''));
  if (!base || !/^[A-Za-z0-9 ._\-]+$/.test(base)) return null;
  const out = await ps(`Get-Process -Name '${base.replace(/'/g, "''")}' -ErrorAction SilentlyContinue | Select-Object Id, Path | ConvertTo-Json -Compress`);
  let list = []; try { const j = JSON.parse(out || '[]'); list = Array.isArray(j) ? j : [j]; } catch {}
  const here = (pkg.installLocation || '').toLowerCase();
  const hit = list.find(p => p && p.Id && (!here || !p.Path || p.Path.toLowerCase().startsWith(here))) || null;
  return hit ? hit.Id : null;
}

function start(pkg, appId) {
  return new Promise((ok, bad) => {
    const p = spawn('explorer.exe', [launchTarget(pkg.familyName, appId)], { windowsHide: true, detached: true, stdio: 'ignore' });
    p.on('error', bad); p.unref(); ok();
  });
}

const notRegistered = title => `${title || 'This game'} isn’t installed for WinDurango yet. Copy WinDurango’s files into the game, turn on Developer Mode in Windows Settings, then run Add-AppxPackage -Register .\\AppxManifest.xml in the game’s folder. The Guide has the steps.`;

module.exports = { readManifest, launchTarget, findPackage, findProcess, start, notRegistered, SAFE_NAME };

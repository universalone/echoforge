// Tests app/appx.js: reading a game's AppxManifest.xml, the launch target, and refusing unsafe package names.
// With EF_LIVE_APPX=1 it also starts Windows Calculator the way a WinDurango game is started, finds its process and closes it.
// Run: node test/appx_test.js
const fs = require('fs'), path = require('path'), os = require('os');
const appx = require('../app/appx');

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const T = path.join(os.tmpdir(), 'ef-appx-test'); fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(T, { recursive: true });
const write = (name, body) => { const f = path.join(T, name, 'AppxManifest.xml'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); return f; };

(async () => {
  const game = write('Some Game', `<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/2010/manifest">
  <Identity Name="Studio.SomeGame" Publisher="CN=Studio" Version="1.0.0.0" ProcessorArchitecture="x64" />
  <Properties><DisplayName>Some Game</DisplayName></Properties>
  <Applications><Application Id="Game" Executable="SomeGame.exe" EntryPoint="SomeGame.App"><VisualElements DisplayName="ms-resource:Title" /></Application></Applications>
</Package>`);
  let m = await appx.readManifest(game);
  check('reads the game name, app and exe', m.name === 'Studio.SomeGame' && m.appId === 'Game' && m.exe === 'SomeGame.exe' && m.title === 'Some Game', JSON.stringify(m));
  m = await appx.readManifest(write('Resource Title', '<Package><Identity Name="A.B" Publisher="CN=X"/><Properties><DisplayName>ms-resource:AppName</DisplayName></Properties><Applications><Application Id="App" Executable="b.exe"/></Applications></Package>'));
  check('a resource title is left blank', m.title === '' && m.name === 'A.B');
  check('launch target', appx.launchTarget('Studio.SomeGame_abc123', 'Game') === 'shell:AppsFolder\\Studio.SomeGame_abc123!Game');
  check('unsafe package names refused', !appx.SAFE_NAME.test("x'; Remove-Item C:\\ -Recurse; '") && !appx.SAFE_NAME.test('') && appx.SAFE_NAME.test('Microsoft.WindowsCalculator'));
  check('unsafe name never reaches PowerShell', (await appx.findPackage("a'b")) === null);
  check('a game that isn’t installed is reported', (await appx.findPackage('EchoForge.Test.NotInstalled')) === null && /isn’t installed for WinDurango/.test(appx.notRegistered('Some Game')));
  check('no process for a game that isn’t running', (await appx.findProcess({ installLocation: T }, 'SomeGame.exe')) === null);

  if (process.env.EF_LIVE_APPX) {
    const pkg = await appx.findPackage('Microsoft.WindowsCalculator');
    if (!pkg) console.log('skip live test: Calculator isn’t installed');
    else {
      await appx.start(pkg, 'App');
      let pid = null; for (let i = 0; i < 15 && !pid; i++) { await new Promise(r => setTimeout(r, 1000)); pid = await appx.findProcess(pkg, 'CalculatorApp.exe'); }
      check('live: starts an installed app and finds its process', !!pid, String(pid));
      if (pid) { try { process.kill(pid); } catch {} await new Promise(r => setTimeout(r, 1500)); check('live: notices the app closed', (await appx.findProcess(pkg, 'CalculatorApp.exe')) === null); }
    }
  }
  fs.rmSync(T, { recursive: true, force: true });
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

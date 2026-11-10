// EchoForge Guide: the step-by-step manual on the Guide page (F1) and the short tour shown after a first install.
// A step's go: opens that page ("view" or "view:param"); act: runs that action instead. Keep labels in step with the app.
window.EF_GUIDE = [
  { id: 'start', title: 'Getting started', icon: 'wand',
    intro: 'EchoForge finds your games, opens each one in the right emulator and backs up your saves. It doesn’t include games, emulators’ system files or keys.',
    steps: [
      { text: 'Run the setup assistant. It asks which consoles you play, links your emulators, finds your game folders and checks your firmware.', act: 'wizard', label: 'Run setup' },
      { text: 'Look at Your PC to see your graphics card, memory and drives, and how well your PC handles each console.', go: 'pc' },
      { text: 'Open a console from the menu on the left. Its dot turns green when it’s ready to play. If it isn’t, press What’s missing? on that console’s page.' }
    ],
    tips: ['You can run setup again any time from Settings → General → Setup assistant.', 'Got a racing wheel? Settings → Controller → Racing wheel learns it in a minute. Then press Use racing wheel on a PS3 or PS2 racing game’s page: EchoForge sets it up as a Logitech G27 (PS3) or Driving Force (PS2) before the game starts.', 'Open Settings → Home dashboard to switch dashboards (Classic, Couch, Collector, Minimal, Discover), turn sections on or off and move them, or save your own; the Preview tab shows it before you switch. Pin to Home on any game’s page puts it on your Pinned shelf.', 'Make EchoForge yours in Settings → Appearance → Skin: pick a built-in skin, make one from any game’s cover, press Surprise me, or press Customize to change every color, both fonts, the borders and the corners. Skins can be shared as .efskin files.', 'During a game, tap Select + Start (Share + Options on PlayStation, Back + Start on Xbox) or press Ctrl+Shift+P for EchoForge’s menu: resume, quick save and load, screenshot, controller check or quit. Hold Select + Start for 2 seconds, or press Ctrl+Shift+Q, to quit straight away. EchoForge asks the emulator to close so it can save first.', 'PS3 games not seeing your controller? EchoForge sets up your PS4, PS5 or Xbox-style controller in RPCS3 automatically. If it ever stops working, open PS3 in the sidebar and press Set up controller.', 'EchoForge checks for new versions of itself once a day. When one is ready, Home shows Update now, or use Settings → About → Check for updates. Your library and settings are kept.'] },

  { id: 'games', title: 'Adding your games', icon: 'folder',
    intro: 'Tell EchoForge where each console’s games are. They can be on any drive.',
    steps: [
      { text: 'Open a console from the menu, choose the Setup tab and press Add game folder. Pick the folder that holds that console’s games.' },
      { text: 'EchoForge scans the folder and adds each game with its cover. After adding new games, press Scan now on the console page, or F5 to scan everything.' },
      { text: 'To have EchoForge sort new game files for you, open Import and choose a folder. EchoForge reads each disc to see which console it’s for, unpacks it into that console’s folder, checks every file and adds it. This needs 7-Zip.', go: 'inbox' },
      { text: 'Each folder shows what kind of drive it’s on, like NVMe SSD or USB HDD. PS4 and newer games load best from an SSD.' }
    ],
    tips: ['Use only games you made from discs you own.'] },

  { id: 'emulators', title: 'Emulators', icon: 'emu',
    intro: 'EchoForge opens your games in standalone emulators. Download them only from their official pages.',
    steps: [
      { text: 'Open Emulators and press Auto-detect on all drives. EchoForge looks in the usual places and links what it finds.', go: 'emulators' },
      { text: 'For anything it didn’t find, press Locate and pick the emulator’s .exe, or Official page to download it from the official site.' },
      { text: 'Launch options control how the emulator opens a game. Leave them as they are unless the emulator’s own guide says otherwise. Reset options puts them back.' },
      { text: 'KytyPS5 and shadPS4 have an Updates line. Press Check now, then Update to install the newest build. EchoForge checks the download, backs up the files it replaces and keeps your settings and saves.' },
      { text: 'Choose which builds each emulator is offered. Tested: shadPS4’s stable releases, or KytyPS5 builds that have been out for two days. Latest: every new build, as soon as it’s out. Keep this version: no updates, though the newest build is still shown. Switching to Tested never installs an older build.', go: 'emulators' },
      { text: 'If a new build works worse, press Roll back to put the previous version back. Close the emulator first: EchoForge won’t change one that’s running.' },
      { text: 'Xbox One has no emulator to link. Install each game with WinDurango’s steps: copy WinDurango’s files into the game, turn on Developer Mode in Windows Settings, and register the game by running Add-AppxPackage -Register .\\AppxManifest.xml in its folder. Then add the game’s folder to Xbox One and press Play.', go: 'console:xone' }
    ],
    tips: ['EchoForge checks for emulator updates once a day and tells you. Nothing installs until you press Update. Turn this off in Settings → General.'] },

  { id: 'firmware', title: 'Firmware & BIOS', icon: 'shield',
    intro: 'Some consoles need system files from your own console before games will run.',
    steps: [
      { text: 'PS1 and PS2 need a BIOS, the original Xbox needs its boot ROM and flash BIOS, and PS4 and PS5 can use optional libraries. PS3 firmware is a free download from Sony.' },
      { text: 'Open Firmware & BIOS, press Choose base folder and pick one folder for all of them. Create console subfolders makes a folder for each console.', go: 'firmware' },
      { text: 'Put each console’s files in its folder. EchoForge checks they’re there, and checks known files’ checksums so a bad dump is caught before you play.' }
    ],
    tips: ['EchoForge never downloads or copies firmware. Dump it from consoles you own.'] },

  { id: 'play', title: 'Playing', icon: 'play',
    intro: 'Pick a game and play. EchoForge checks everything is ready first.',
    steps: [
      { text: 'Press Play on a game. EchoForge checks the emulator, firmware and game file first. If something’s missing, it tells you what and takes you to the fix.' },
      { text: 'While a game runs, EchoForge gets out of the way. Choose what it does in Settings → Launching & performance → When a game starts.' },
      { text: 'Press Stop in the top bar to close the game.' },
      { text: 'Big Picture fills the screen with a view made for a controller and a TV. Press F10 or the button in the top bar. F11 switches full screen on and off.' },
      { text: 'With a controller: move with the stick or D-pad, A to choose, B to go back, X to play the highlighted game, Y to favorite it, LB and RB to switch pages, Start for Settings and Back for Big Picture. PlayStation controllers use ✕ ○ □ △ in the same places.' }
    ],
    tips: ['The first minutes of a new game can stutter while the emulator prepares its graphics. It gets smoother the more you play.'] },

  { id: 'library', title: 'Your library', icon: 'lib',
    intro: 'Browse, search and organize every game in one place.',
    steps: [
      { text: 'All Games shows everything. Filter by console or Favorites, or search with Ctrl+F.', go: 'library' },
      { text: 'Choose Details on a game for its page: screenshots, play time, and Play, Favorite, Hide, Change cover and Show file.' },
      { text: 'A game’s page also shows what the game is about, with its year, genre and developer, from Wikipedia. Wrong game or none found? Under Manage → Synopsis, type your own, press Look it up again, or press Wrong game.' },
      { text: 'Collections groups series EchoForge found across your consoles. On a game’s page you can move it into a collection or keep it out of one.', go: 'collections' },
      { text: 'Hidden games are left out of your lists. Show them again in Settings → Library → Show hidden games.' },
      { text: 'Remove takes a game off your list without touching its files. Recycle Bin sends its files to the Windows Recycle Bin, so you can still restore them.' }
    ] },

  { id: 'backups', title: 'Save backups', icon: 'save',
    intro: 'Your saves are copied to a safe place automatically.',
    steps: [
      { text: 'EchoForge backs up each emulator’s saves after you play, and once a week. Choose where backups go on the Save backups page. A different drive from your emulators is safest.', go: 'backups' },
      { text: 'Press Back up to make a backup now, or Restore to put an earlier one back. Your current saves are backed up first, so a restore can be undone.' },
      { text: 'To keep a copy of EchoForge’s own settings and library, use Settings → Data & backup → Back up.' }
    ] },

  { id: 'shared', title: 'Shared games', icon: 'share',
    intro: 'Copy your own games and emulators between your own PCs on your home network.',
    steps: [
      { text: 'On the PC that has the games, open Shared games and turn sharing on. It shows a code.', go: 'shared' },
      { text: 'On the other PC, enter the first PC’s name or address and the code, tick the games you want and press Install. Every file is checked, and a stopped install picks up where it left off.' },
      { text: 'Emulators can be copied the same way with Copy. Saves, caches and firmware stay behind.' }
    ],
    tips: ['Sharing is off by default, only answers PCs on your home network and stops when you close EchoForge. The connection isn’t encrypted, so only use it at home.'] },

  { id: 'storage', title: 'Drives and storage', icon: 'pc',
    intro: 'Put each game on the drive that suits it.',
    steps: [
      { text: 'In Settings → Library, set a Fast library root on an SSD for PS4 and newer, and a Storage library root on a hard drive for older consoles.', go: 'settings' },
      { text: 'Your PC suggests moves: big games loading slowly from a hard drive, and older games using SSD space they don’t need. Move all and Optimize all move them, checking every file.', go: 'pc' },
      { text: 'Games on an unplugged drive show as Drive offline until you plug it back in.' }
    ] },

  { id: 'settings', title: 'Settings', icon: 'gear',
    intro: 'Make EchoForge work the way you like.',
    steps: [
      { text: 'General: the page EchoForge opens on, Start with Windows, emulator update checks and the setup assistant.', go: 'settings' },
      { text: 'Appearance: accent color, background, cover size and shape, and the glow effects.' },
      { text: 'Appearance → Splash screen picks what you see while EchoForge opens: EchoForge, Cartridge, Disc, Orb, Cube, Neon, Minimal, or your own picture or video. Choose the size (up to full screen) and how long it shows, then press Preview.' },
      { text: 'Library, Import and Launching & performance: where games live, how new games are added and what happens when a game starts.' },
      { text: 'Controller, Sound and Big Picture: button labels, rumble, interface sounds and the TV view.' },
      { text: 'Accessibility: less motion, high contrast and a bolder outline around the selected item.' }
    ] },

  { id: 'fix', title: 'Fixing problems', icon: 'scan',
    intro: 'Most problems come down to a missing file, a missing emulator or an unplugged drive.',
    steps: [
      { text: 'A game won’t start: EchoForge lists what’s missing and has a button for each fix. Check the console page’s What’s missing? too.' },
      { text: 'The emulator closes right away: EchoForge shows the emulator’s last message. Common causes are missing firmware, the wrong kind of game file or changed launch options. For KytyPS5 or shadPS4, try Roll back or Update.', go: 'emulators' },
      { text: 'Game file not found: the drive is unplugged or the file moved. Plug the drive back in, or remove the game and scan again.' },
      { text: 'A game is missing its cover: turn on Settings → Library → Download missing box art, or use Change cover on the game’s page. For PS3 games, also turn on PS3 covers from GameTDB, and for Xbox 360 games, Xbox 360 covers from XboxUnity.', go: 'settings' },
      { text: 'Import says 7-Zip is needed: install 7-Zip from its official site, then press Refresh.', go: 'inbox' },
      { text: 'Updates say GitHub is limiting requests: wait an hour and press Check now again.' },
      { text: 'An Xbox One game needs installing first, or doesn’t start: finish WinDurango’s steps for that game. WinDurango supports only a few games so far.', go: 'console:xone' }
    ] },

  { id: 'legal', title: 'Using EchoForge legally', icon: 'shield',
    intro: 'EchoForge contains no games, firmware, BIOS files or keys, and doesn’t download them or break copy protection.',
    steps: [
      { text: 'Use only games and system files you made yourself from discs, cartridges and consoles you own, where your local law allows it.' },
      { text: 'Share games only between your own PCs, and download emulators only from their official pages.' }
    ] }
];

// The tour after a first install. target: what to highlight (none = centered card).
window.EF_TOUR = [
  { title: 'Welcome to EchoForge', text: 'Here’s a quick look around. It takes about a minute, and you can skip it any time.' },
  { target: '#side', title: 'The menu', text: 'Every page lives here. Consoles are grouped from Next-Gen to Classics, and each one’s dot turns green when it’s ready to play.' },
  { target: '#side [data-arg="home"]', title: 'Home', text: 'Pick up where you left off, plus your favorites, recent additions and collections.' },
  { target: '#side [data-arg^="console:"]', title: 'Console pages', text: 'Each console has a Library of its games, a Setup tab for folders and its emulator, and tips tuned for your PC.' },
  { target: '#side [data-arg="inbox"]', title: 'Import', text: 'Choose a folder and EchoForge adds new game files from it to the right console for you.' },
  { target: '#side [data-arg="emulators"]', title: 'Emulators', text: 'Link your emulators here. KytyPS5 and shadPS4 can also update and roll back from this page.' },
  { target: '#side [data-arg="firmware"]', title: 'Firmware & BIOS', text: 'Some consoles need system files from your own console. EchoForge checks they’re in place.' },
  { target: '.titlebar .search', title: 'Search', text: 'Find any game in any library. Press Ctrl+F from anywhere.' },
  { target: '.winbtns [data-act="bigpic"]', title: 'Big Picture', text: 'A full-screen view made for a controller and a TV. Press F10 to switch it on and off.' },
  { target: '#side [data-arg="guide"]', title: 'The Guide', text: 'Step-by-step help for everything EchoForge does. Open it from here or press F1 any time.' }
];

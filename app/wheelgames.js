// Games known to support racing wheels, per console. Sources: Logitech's PS3 compatibility tables for its
// Driving Force, G25 and G27 wheels (support.logi.com, a sample of popular games) and the community "List of
// Logitech Racing Wheels compatible games" (Wikipedia, October 2023). A game missing here may still support wheels.
// EchoForge connects wheels for PS3 (RPCS3, as a G27) and PS2 (PCSX2, as a Driving Force); the other consoles'
// lists are shown for information.
(function (root) {
  'use strict';
  const LISTS = {
    ps3: ['Baja: Edge of Control', 'Burnout Paradise', 'Colin McRae: Dirt', 'DiRT', 'Daytona USA', 'Dirt 2', 'Dirt 3', 'F1 2010', 'F1 2011', 'F1 2012', 'F1 2013', 'F1 2014',
      'Ferrari Challenge: Trofeo Pirelli', 'Formula One Championship Edition', 'Formula 1 Champion Edition', 'Gran Turismo 5', 'Gran Turismo 5 Prologue', 'Gran Turismo 6', 'Gran Turismo HD Concept',
      'GRID', 'Race Driver: GRID', 'GRID 2', 'GRID Autosport', 'Grand Theft Auto V', 'Initial D: Extreme Stage', 'Midnight Club: Los Angeles', 'MotorStorm: Apocalypse', 'NASCAR 08', 'NASCAR 09',
      'Need for Speed: Hot Pursuit', 'Need for Speed: Carbon', 'Need for Speed: ProStreet', 'Need for Speed: Most Wanted', 'Need for Speed: Shift', 'Need for Speed: Shift 2 Unleashed',
      'Need for Speed: Undercover', 'Need for Speed: Underground 2', 'Need for Speed: The Run', 'OutRun Online Arcade', 'Ridge Racer 7', 'Sega Rally Revo', 'Sega Rally Revolution',
      'Sonic & Sega All-Stars Racing', 'Split Second: Velocity', 'Stuntman: Ignition', 'Supercar Challenge', 'Superstars V8 Racing', 'Test Drive: Ferrari Racing Legends', 'Test Drive Unlimited 2',
      'WRC: FIA World Rally Championship', 'WRC 3', 'WRC 4', 'WRC 5: FIA World Rally Championship'],
    ps2: ['18 Wheeler: American Pro Trucker', 'Auto Modellista', 'Burnout', 'Burnout 2: Point of Impact', 'Burnout 3: Takedown', 'Burnout Revenge', 'Colin McRae Rally 3', 'Colin McRae Rally 04',
      'Colin McRae Rally 2005', 'Corvette', 'Critical Velocity', 'Dakar 2: The World’s Ultimate Rally', 'Driven', 'Enthusia Professional Racing', 'F1 2001', 'F1 2002', 'F1 Career Challenge',
      'Ferrari Challenge: Trofeo Pirelli', 'FlatOut', 'Ford Mustang: The Legend Lives', 'Formula One 2001', 'Formula One 2002', 'Formula One 2003', 'Formula One 04', 'Formula One 05', 'Formula One 06',
      'Gran Turismo 3: A-Spec', 'Gran Turismo 4', 'Gran Turismo Concept: 2001 Tokyo', 'Gran Turismo Concept: 2002 Tokyo-Geneva', 'Grand Prix Challenge', 'Hot Wheels Velocity X',
      'Initial D: Special Stage', 'Juiced', 'Juiced 2: Hot Import Nights', 'Kaido Battle 2: Chain Reaction', 'Knight Rider: The Game', 'L.A. Rush', 'Lotus Challenge', 'Midnight Club II',
      'Midnight Club 3: DUB Edition', 'Motor Mayhem', 'NASCAR 2005: Chase for the Cup', 'NASCAR 06: Total Team Control', 'NASCAR Heat 2002', 'NASCAR Heat 2: Road to the Championship',
      'NASCAR Thunder 2002', 'NASCAR Thunder 2003', 'NASCAR Thunder 2004', 'Need for Speed: Carbon', 'Need for Speed: Hot Pursuit', 'Need for Speed: Hot Pursuit 2', 'Need for Speed: Most Wanted',
      'Need for Speed: ProStreet', 'Need for Speed: Underground', 'Need for Speed: Underground 2', 'Need for Speed: Undercover', 'Pac-Man World Rally', 'Pro Race Driver', 'R: Racing Evolution',
      'Rally Championship', 'Rally Fusion: Race of Champions', 'Richard Burns Rally', 'RoadKill', 'Sega Rally 2006', 'Sega Rally Championship', 'Shox', 'Smuggler’s Run 2: Hostile Territory',
      'Starsky & Hutch', 'Street Racing Syndicate', 'Test Drive', 'Test Drive Off-Road Wide Open', 'The King of Route 66', 'The Simpsons: Hit & Run', 'The Simpsons: Road Rage', 'TOCA Race Driver',
      'Tokyo Xtreme Racer 3', 'Tokyo Xtreme Racer: Drift', 'Tokyo Xtreme Racer: Drift 2', 'Total Immersion Racing', 'Twisted Metal: Black Online', 'V-Rally 3',
      'World of Outlaws: Sprint Cars 2002', 'World Rally Championship', 'WRC 3', 'WRC 4', 'WRC II Extreme', 'WRC: Rally Evolved'],
    ps4: ['Assetto Corsa', 'Baja: Edge of Control', 'Dakar 18', 'Dirt 4', 'Dirt 5', 'Dirt Rally', 'Dirt Rally 2.0', 'DriveClub', 'F1 2015', 'F1 2016', 'F1 2017', 'F1 2018', 'F1 2019', 'F1 2020',
      'F1 2021', 'F1 22', 'F1 2022', 'Farming Simulator 15', 'Farming Simulator 17', 'Farming Simulator 19', 'Farming Simulator 22', 'Gran Turismo Sport', 'Gran Turismo 7', 'Grand Theft Auto V',
      'Gravel', 'GRID', 'Grip: Combat Racing', 'Monster Jam Steel Titans', 'NASCAR Heat 3', 'NASCAR Heat 4', 'NASCAR Heat 5', 'Need for Speed Heat', 'Need for Speed Payback', 'Project CARS',
      'Project CARS 2', 'Project CARS 3', 'SnowRunner', 'Spintires: MudRunner', 'The Crew 2', 'Truck Driver', 'V-Rally 4', 'WRC 5', 'WRC 6', 'WRC 7', 'WRC 8', 'WRC 9', 'Wreckfest', 'Xenon Racer'],
    gc: ['4x4 Evo 2', 'Auto Modellista', 'Burnout 2: Point of Impact', 'Dakar 2: The World’s Ultimate Rally', 'F-Zero GX', 'Hot Wheels Velocity X', 'Mario Kart: Double Dash!!',
      'NASCAR 2005: Chase for the Cup', 'NASCAR Thunder 2003', 'Need for Speed: Hot Pursuit 2', 'Need for Speed: Most Wanted', 'Need for Speed: Underground', 'Pro Rally 2002', 'R: Racing Evolution',
      'Rally Championship', 'Starsky & Hutch', 'Street Racing Syndicate', 'Taxi 3', 'The Simpsons: Hit & Run', 'V-Rally 3'],
    wii: ['F1 2009', 'Ferrari Challenge: Trofeo Pirelli', 'Need for Speed: Undercover', 'SpeedZone']
  };
  // Racing games Logitech lists as NOT working with its wheels.
  const NO = { ps3: ['MotorStorm', 'MotorStorm: Pacific Rift', 'Wipeout', 'Wipeout HD', 'Wipeout HD Fury'] };
  // Consoles where EchoForge can connect the wheel to the game.
  const CONNECTED = ['ps3', 'ps2'];

  // Same game, different spelling: lower case, no punctuation, no leading "The", "Pro Street" = "ProStreet", "&" = "and".
  function norm(t) {
    return String(t || '').toLowerCase()
      .replace(/\(.*?\)|\[.*?\]/g, ' ')            // regions, years and IDs in brackets
      .replace(/[’']/g, '').replace(/&/g, ' and ')
      .replace(/\bpro street\b/g, 'prostreet').replace(/\bdirt\b/g, 'dirt')
      .replace(/[^a-z0-9]+/g, ' ').replace(/^the /, '').replace(/\s+/g, ' ').trim();
  }
  const sets = {}, noSets = {};
  for (const [c, l] of Object.entries(LISTS)) sets[c] = new Set(l.map(norm));
  for (const [c, l] of Object.entries(NO)) noSets[c] = new Set(l.map(norm));
  // 'yes', 'no' (Logitech says it doesn't work) or null (not on the lists).
  function support(consoleId, title) {
    const n = norm(title); if (!n) return null;
    if (noSets[consoleId] && noSets[consoleId].has(n)) return 'no';
    if (sets[consoleId] && sets[consoleId].has(n)) return 'yes';
    // Library names often drop subtitles' colons or add editions: "Gran Turismo 5 XL Edition", "GRID Reloaded".
    const s = sets[consoleId]; if (!s) return null;
    for (const k of s) if (n.startsWith(k + ' ') && /^(xl|complete|ultimate|limited|special|collectors|game of the year|goty|platinum|greatest hits|edition|academy|spec ii|reloaded)\b/.test(n.slice(k.length + 1))) return 'yes';
    return null;
  }
  const api = { LISTS, NO, CONNECTED, norm, support, connected: c => CONNECTED.includes(c) };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.EF_WHEELGAMES = api;
})(typeof window !== 'undefined' ? window : globalThis);

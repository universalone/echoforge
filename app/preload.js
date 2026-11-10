// Narrow, explicit bridge between the UI and the main process.
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('ef', {
  load: invoke('store:load'),
  save: invoke('store:save'),
  exportData: invoke('store:export'),
  importData: invoke('store:import'),
  pickFile: invoke('dialog:file'),
  pickFolder: invoke('dialog:folder'),
  openUrl: invoke('shell:external'),
  openPath: invoke('shell:path'),
  reveal: invoke('shell:reveal'),
  setLoginItem: invoke('app:loginItem'),
  relaunch: invoke('app:relaunch'),
  version: invoke('app:version'),
  paths: invoke('app:paths'),
  exists: invoke('fs:exists'),
  existsMany: invoke('fs:existsMany'),
  readText: invoke('fs:readText'),
  fetchArt: invoke('art:fetch'),
  fetchShots: invoke('art:shots'),
  fetchAbout: invoke('about:fetch'),
  moveGame: invoke('game:move'),
  recycleInfo: invoke('game:recycleInfo'),
  recycleGame: invoke('game:recycle'),
  readImage: invoke('fs:readImage'),
  mkdirs: invoke('fs:mkdirs'),
  scan: invoke('fs:scan'),
  checkBios: invoke('bios:check'),
  probe: invoke('hw:probe'),
  freeRam: invoke('hw:freeRam'),
  launch: invoke('emu:launch'),
  launchAppx: invoke('appx:launch'),
  stop: invoke('emu:stop'),
  runningGame: invoke('emu:running'),
  detect: invoke('emu:detect'),
  inbox: {
    scan: invoke('inbox:scan'),
    import: invoke('inbox:import'),
    recycle: invoke('inbox:recycle'),
    watch: invoke('inbox:watch'),
    onChange: (fn) => ipcRenderer.on('inbox:changed', () => fn()),
    onProgress: (fn) => ipcRenderer.on('inbox:progress', (_e, v) => fn(v))
  },
  downloads: { status: invoke('downloads:status'), check: invoke('downloads:check'), set: invoke('downloads:set') },
  pads: { status: invoke('pads:status'), setup: invoke('pads:setup') },
  wheels: { rpcs3: invoke('wheel:rpcs3'), pcsx2: invoke('wheel:pcsx2'), padEnv: invoke('wheel:padEnv') },
  skins: { exportSkin: invoke('skin:export'), importSkin: invoke('skin:import'), saveWall: invoke('skin:saveWall') },
  appUpdates: {
    check: invoke('appup:check'),
    install: invoke('appup:install'),
    onProgress: (fn) => ipcRenderer.on('appup:progress', (_e, v) => fn(v))
  },
  emuUpdates: {
    list: invoke('emuup:list'),
    check: invoke('emuup:check'),
    update: invoke('emuup:update'),
    rollback: invoke('emuup:rollback'),
    onProgress: (fn) => ipcRenderer.on('emuup:progress', (_e, v) => fn(v))
  },
  share: {
    info: invoke('share:info'),
    newCode: invoke('share:newCode'),
    host: invoke('share:host'),
    list: invoke('share:list'),
    tools: invoke('share:tools'),
    toolsBase: invoke('share:toolsBase'),
    install: invoke('share:install'),
    cancel: invoke('share:cancel'),
    onProgress: (fn) => ipcRenderer.on('share:progress', (_e, v) => fn(v))
  },
  checkCompat: invoke('compat:check'),
  backup: { status: invoke('backup:status'), run: invoke('backup:run'), restore: invoke('backup:restore') },
  onCompat: (fn) => ipcRenderer.on('compat:result', (_e, v) => fn(v)),
  ready: () => ipcRenderer.send('app:ready'),
  splashStatus: (m) => ipcRenderer.send('splash:status', m),
  win: {
    min: () => ipcRenderer.send('win:min'),
    max: () => ipcRenderer.send('win:max'),
    close: () => ipcRenderer.send('win:close'),
    fullscreen: (on) => ipcRenderer.send('win:fullscreen', on),
    onState: (fn) => ipcRenderer.on('win:state', (_e, v) => fn(v))
  },
  onGameExit: (fn) => ipcRenderer.on('game:exit', (_e, v) => fn(v)),
  onGameQuitting: (fn) => ipcRenderer.on('game:quitting', (_e, v) => fn(v))
});

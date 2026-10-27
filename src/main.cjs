'use strict';
const {app, BrowserWindow, ipcMain, desktopCapturer, session, dialog} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const {pathToFileURL} = require('node:url');
const {randomUUID} = require('node:crypto');
const {Store} = require('./storage.cjs');
const {normalize} = require('./core.cjs');
const {analyze} = require('./analyzer.cjs');
let win, store, sourceId = null, recording = null, closing = false;
const page = pathToFileURL(path.join(__dirname, 'index.html')).href;
function trusted(event) { if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== page) throw Error('Untrusted sender.'); }
function handle(name, callback) {ipcMain.handle(name, async (e, ...args) => {trusted(e); return callback(...args);});}
async function createWindow() {
  win = new BrowserWindow({width: 1460, height: 940, minWidth: 980, minHeight: 680, backgroundColor: '#101216', title: 'SkillForge', webPreferences: {preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false}});
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.on('close', async e => {
    if (closing) return;
    e.preventDefault();
    const result = await dialog.showMessageBox(win, {type: 'question', buttons: ['Keep working', 'Exit without saving'], defaultId: 0, cancelId: 0, message: 'Exit SkillForge?', detail: 'Save your workflow before exiting. An unfinished recording will be discarded.'});
    if (result.response === 1) {if (recording) {await recording.handle.close(); await fs.rm(recording.file, {force: true}); recording = null;} closing = true; win.close();}
  });
  await win.loadFile(path.join(__dirname, 'index.html'));
}
app.whenReady().then(async () => {
  store = new Store(path.join(app.getPath('userData'), 'sessions'));
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin, details) => contents === win?.webContents && details?.isMainFrame !== false && ['media', 'display-capture'].includes(permission));
  session.defaultSession.setPermissionRequestHandler((contents, permission, cb, details) => cb(contents === win?.webContents && details?.requestingUrl === page && ['media', 'display-capture'].includes(permission)));
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    const id = sourceId; sourceId = null;
    if (!id || request.frame !== win?.webContents.mainFrame) return callback(null);
    try {const sources = await desktopCapturer.getSources({types: ['screen', 'window']}); const video = sources.find(s => s.id === id); callback(video ? {video} : null);} catch {callback(null);}
  });
  handle('sources', async () => (await desktopCapturer.getSources({types: ['screen', 'window'], thumbnailSize: {width: 240, height: 135}})).map(s => ({id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL()})));
  handle('choose-source', async id => {if (typeof id !== 'string' || !(await desktopCapturer.getSources({types: ['screen', 'window']})).some(s => s.id === id)) throw Error('Source unavailable.'); sourceId = id; return true;});
  handle('sessions-list', () => store.list());
  handle('sessions-save', input => store.save(input));
  handle('sessions-load', (id, revision) => store.load(id, revision));
  handle('sessions-history', id => store.history(id));
  handle('sessions-delete', async id => {const result = await dialog.showMessageBox(win, {type: 'warning', buttons: ['Cancel', 'Delete session and recording'], cancelId: 0, defaultId: 0, message: 'Delete all revisions and recording for this session?'}); if (result.response !== 1) return false; await store.delete(id); return true;});
  handle('session-import', async () => {
    const result = await dialog.showOpenDialog(win, {filters: [{name: 'SkillForge or browser events', extensions: ['json']}], properties: ['openFile']});
    if (result.canceled) return null;
    if ((await fs.stat(result.filePaths[0])).size > 2_000_000) throw Error('Import limit is 2 MB.');
    return normalize({...JSON.parse(await fs.readFile(result.filePaths[0], 'utf8')), id: `session-${randomUUID()}`});
  });
  handle('session-backup', async input => {
    const s = normalize(input); const result = await dialog.showSaveDialog(win, {defaultPath: 'workflow-session.json', filters: [{name: 'Session JSON', extensions: ['json']}]});
    if (result.canceled) return false; await fs.writeFile(result.filePath, JSON.stringify(s, null, 2), {mode: 0o600}); return true;
  });
  handle('skill-export', async (input, target) => {const result = await dialog.showOpenDialog(win, {properties: ['openDirectory', 'createDirectory'], title: 'Choose a folder for your skill bundle'}); if (result.canceled) return null; return store.export(input, target, result.filePaths[0]);});
  handle('analyze', (input, model) => analyze(input, model));
  handle('recording-start', async id => {
    if (recording) throw Error('A recording is already active.');
    const dir = store.dir(id); await fs.mkdir(dir, {recursive: true, mode: 0o700});
    const file = path.join(dir, `capture-${randomUUID()}.webm`); const fileHandle = await fs.open(file, 'wx', 0o600);
    recording = {file, id, handle: fileHandle, bytes: 0, started: Date.now()}; return true;
  });
  handle('recording-chunk', async bytes => {
    if (!recording || !(bytes instanceof Uint8Array) || bytes.byteLength > 20_000_000) throw Error('Invalid recording chunk.');
    const r = recording;
    if (r.bytes + bytes.byteLength > 500_000_000 || Date.now() - r.started > 31 * 60 * 1000) throw Error('Recording limit reached (500 MB / 30 minutes). Stop and save.');
    await r.handle.write(bytes); r.bytes += bytes.byteLength; return r.bytes;
  });
  handle('recording-finish', async discard => {
    if (!recording) return null; const r = recording; recording = null; await r.handle.close();
    if (discard) {await fs.rm(r.file, {force: true}); return null;} return {bytes: r.bytes, filename: path.basename(r.file)};
  });
  handle('recording-export', async id => {
    const dir = store.dir(id); const files = (await fs.readdir(dir)).filter(x => /^capture-[a-f0-9-]+\.webm$/.test(x));
    if (!files.length) throw Error('No saved recording for this session.');
    const file = files.sort().at(-1); // Users may make multiple captures; expose the complete session folder through the picker.
    const result = await dialog.showOpenDialog(win, {defaultPath: dir, filters: [{name: 'Local recording', extensions: ['webm']}], properties: ['openFile']});
    if (result.canceled) return false;
    const selected = path.resolve(result.filePaths[0]); if (path.dirname(selected) !== path.resolve(dir) || !files.includes(path.basename(selected))) throw Error('Choose a recording from this session.');
    const target = await dialog.showSaveDialog(win, {defaultPath: file, filters: [{name: 'Recording', extensions: ['webm']}]});
    if (target.canceled) return false; if (path.resolve(target.filePath) === selected) return true; await fs.copyFile(selected, target.filePath); return true;
  });
  await createWindow();
});
app.on('window-all-closed', () => app.quit());

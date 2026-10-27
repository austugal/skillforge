'use strict';
const {contextBridge, ipcRenderer} = require('electron');
const invoke = channel => (...args) => ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld('desktop', {
  sources: invoke('sources'), chooseSource: invoke('choose-source'), list: invoke('sessions-list'), save: invoke('sessions-save'), load: invoke('sessions-load'), history: invoke('sessions-history'), delete: invoke('sessions-delete'), import: invoke('session-import'), backup: invoke('session-backup'), export: invoke('skill-export'), analyze: invoke('analyze'), recordStart: invoke('recording-start'), recordChunk: invoke('recording-chunk'), recordFinish: invoke('recording-finish'), recordingExport: invoke('recording-export'),
});

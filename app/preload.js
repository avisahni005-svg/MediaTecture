// The only bridge between the pages and the app. Pages get nothing else from the system.
const { contextBridge, ipcRenderer } = require('electron');

// used by the output page (sketch.html) to tell the app what is connected
contextBridge.exposeInMainWorld('appBridge', {
  emit: (channel, data) => ipcRenderer.send('from-sketch', channel, data),
});

// used by the control window (ui/control.html)
contextBridge.exposeInMainWorld('controlApi', {
  getState: () => ipcRenderer.invoke('control:get'),
  setShared: (patch) => ipcRenderer.invoke('control:setShared', patch),
  setOutput: (index, patch) => ipcRenderer.invoke('control:setOutput', index, patch),
  action: (name, index) => ipcRenderer.invoke('control:action', name, index),
  onState: (fn) => ipcRenderer.on('state', (_event, state) => fn(state)),
});

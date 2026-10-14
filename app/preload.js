// The only bridge between the pages and the app. Pages get nothing else from the system.
const { contextBridge, ipcRenderer } = require('electron');

// used by the output page (sketch.html) to tell the app what is connected
contextBridge.exposeInMainWorld('appBridge', {
  emit: (channel, data) => ipcRenderer.send('from-sketch', channel, data),
});

// used by the control window (ui/control.html)
contextBridge.exposeInMainWorld('controlApi', {
  getState: () => ipcRenderer.invoke('control:get'),
  set: (patch) => ipcRenderer.invoke('control:set', patch),
  action: (name) => ipcRenderer.invoke('control:action', name),
  onState: (fn) => ipcRenderer.on('state', (_event, state) => fn(state)),
});

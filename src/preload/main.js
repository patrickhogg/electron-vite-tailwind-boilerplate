import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Custom APIs for renderer
const api = {
  // Example function: Send data to main process
  // sendData: (data) => ipcRenderer.send('main-data', data),
  
  // Example function: Invoke main process handler and get response
  // doSomething: (args) => ipcRenderer.invoke('main-do-something', args),
  
  // Expose app version (from main.js)
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error('Error exposing API via contextBridge:', error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}

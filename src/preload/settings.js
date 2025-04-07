const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Renderer to Main (Invoke/Handle)
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  // Renderer to Main (Send/On)
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  // Main to Renderer (Listen)
  on: (channel, listener) => {
    // Deliberately strip event as it includes `sender`
    const subscription = (event, ...args) => listener(...args);
    ipcRenderer.on(channel, subscription);
    // Return a function to remove the listener
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  // Remove a specific listener
  removeListener: (channel, listener) => {
    ipcRenderer.removeListener(channel, listener);
  },
  // Remove all listeners for a channel
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

console.log('Preload script for settings window loaded.');

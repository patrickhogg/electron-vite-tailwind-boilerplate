const { contextBridge, ipcRenderer } = require('electron');

// Define the channels allowed for the settings window
const allowedInvokeChannels = [
  'twilio:get-config',          // Get current Twilio config (excluding secret)
  // 'twilio:save-credentials', // REMOVED - Handled by save-and-configure
  'twilio:list-numbers',        // List available Twilio numbers
  'twilio:save-and-configure', // Save final config and trigger TwiML App/Number linking
];

const allowedSendChannels = [
  'close-settings' // Request to close the settings window
];

// No specific main-to-renderer channels needed *only* for settings currently
// const allowedOnChannels = [];

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Renderer to Main (Invoke/Handle)
  invoke: (channel, ...args) => {
    if (allowedInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    console.error(`IPC invoke blocked for channel: ${channel}`);
    return Promise.reject(new Error(`Blocked IPC channel: ${channel}`));
  },
  // Renderer to Main (Send/On)
  send: (channel, ...args) => {
      if (allowedSendChannels.includes(channel)) {
          ipcRenderer.send(channel, ...args);
      } else {
           console.error(`IPC send blocked for channel: ${channel}`);
      }
  },
  // Main to Renderer (Listen) - Keep generic structure but restrict channels if needed
  on: (channel, listener) => {
    // if (!allowedOnChannels.includes(channel)) {
    //     console.error(`IPC on blocked for channel: ${channel}`);
    //     return;
    // }
    // Deliberately strip event as it includes `sender`
    const subscription = (event, ...args) => listener(...args);
    ipcRenderer.on(channel, subscription);
    // Return a function to remove the listener
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  // Remove a specific listener - Keep generic for cleanup
  removeListener: (channel, listener) => {
    ipcRenderer.removeListener(channel, listener);
  },
  // Remove all listeners for a channel - Keep generic for cleanup
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

console.log('Preload script for settings window loaded.');

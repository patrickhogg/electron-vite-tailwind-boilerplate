const { contextBridge, ipcRenderer } = require('electron');

// Define the channels allowed for the main window
const allowedInvokeChannels = [
  'twilio:get-credentials-status', // Check if Twilio credentials are set
  'twilio:get-token',              // Get access token for Voice SDK
  'twilio:get-config',             // Get current config (for audio devices)
  'settings:get-selected-number'   // Get the selected phone number for caller ID
];

const allowedSendChannels = [
  'ui:open-settings-window' // Request to open the settings window
];

// Define channels the main window is allowed to listen on
const allowedOnChannels = [
    'twilio-config-updated' // Signal from main that config has changed
];

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
  // Main to Renderer (Listen)
  on: (channel, listener) => {
    if (!allowedOnChannels.includes(channel)) {
        console.error(`IPC on blocked for channel: ${channel}`);
        // Optionally return an empty remover function or throw an error
        return () => {}; 
    }
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

console.log('Preload script for main window loaded.');

/**
 * @fileoverview Main process script for the Electron application (Boilerplate).
 * This script manages the application lifecycle, including window creation,
 * using the GptApp class.
 */

import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset'; // Assuming you might want an icon later
import { join } from 'path';
import Main from './controllers/Main.js';
import Settings from './controllers/Settings.js'; // Import Settings controller
// import SipManager from './modules/SipManager.js'; // REMOVED
import TwilioManager from './modules/TwilioManager.js'; // Import TwilioManager

// *** ADD VERSION LOGGING ***
const TWILIO_MANAGER_VERSION = 'REFACTORED_V2'; // Increment this if you change TwilioManager significantly
console.log(`*** Loading GptApp - TwilioManager Version Check: ${TWILIO_MANAGER_VERSION} ***`);

export default class GptApp {
  /**
   * Constructs a new GptApp instance.
   * @param {Electron.App} eApp - The Electron app instance.
   */
  constructor(eApp) {
    this._windowHandlers = {};
    this._windows = {};
    this._appMenu = null; // Menu can be added later if needed
    this.eApp = eApp;
    
    // Add version handler (optional but good practice)
    ipcMain.handle('get-app-version', () => {
        return this.eApp.getVersion()
    });
    
    this.appHandlers();
  }

   appHandlers() {
    let scope=this;
    let app=this.eApp;
    app.whenReady().then(() => {
      
      electronApp.setAppUserModelId('com.electron.boilerplate'); // Set a unique AppUserModelId
      
      // Initialize the main controller and open its window
      scope.init();

      app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window);
      });
    
      // Re-create window on macOS dock click when no windows are open
      app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) scope.openWindow(scope.getController('main'));
      });
    });
    
    // Quit the application when all windows are closed (except on macOS)
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        scope.quit(); // Call the enhanced quit method
      }
    });

    // Ensure SipManager stops when app quits unexpectedly or via Cmd+Q etc.
    // Remove the before-quit handler specific to SipManager
    // Twilio SDK connection is managed in the renderer, no specific main process cleanup needed here for that.
    // app.on('before-quit', async (event) => { ... });

  }
  /**
   * Initializes the application by setting up controllers and windows.
   */
  async init() { // Make init async
    this._windowHandlers = {};
    this._windows = {};
    // this.sipManager = null; // REMOVED
    this.twilioManager = null; // Initialize twilioManager property

    // Instantiate TwilioManager
    this.twilioManager = new TwilioManager(this);
    // Initialize the manager (loads store, config, etc.)
    await this.twilioManager.initialize();
    // Bind its IPC Handlers (only after initialization is complete)
    this.twilioManager.bindIpcHandlers(ipcMain);
    console.log(`*** GptApp Init: TwilioManager IPC Handlers Bound (Version: ${TWILIO_MANAGER_VERSION}) ***`);

    // Add controllers
    this.addController(new Main());
    this.addController(new Settings());

    // Setup IPC handler to open the settings window
    ipcMain.on('ui:open-settings-window', () => {
      this.openWindow(this.getController('settings'));
    });

    // --- Remove Placeholder IPC Handlers ---
    // These are now handled within SipManager.bindIpcHandlers()
    // --- Remove Placeholder IPC Handlers ---
    // These are now handled within TwilioManager.bindIpcHandlers()
    // -----------------------------------------

    // IPC handler for the settings window to request closing itself
    // Note: The WindowController base class already sets up 'close-id' listener,
    // so this specific handler might be redundant if Settings.vue uses 'close-settings'.
    // Let's keep it for clarity for now, but could potentially be removed.
    ipcMain.on('close-settings', () => {
        this.closeWindow(this.getController('settings'));
    });

    let controllers = this.controllers();
    for (let i in controllers) {
      this.controllers()[i].onAppReady(this);
    }
    
    // Open the main window immediately
    this.openWindow(this.getController('main'));
  }
  
  async quit() {
    // No specific Twilio cleanup needed here in the main process for SDK connections
    // if (this.sipManager) { ... } // REMOVED
    this.eApp.quit();
  }

  /**
   * Relaunches the application.
   */
  relaunch() {
    // Close all open windows first
    for (let id in this._windows) {
      this.closeWindow(this._windowHandlers[id]);
    }
    
    // Clear window handlers and windows
    this._windowHandlers = {};
    this._windows = {};
    
    // Relaunch the app and exit the current instance
    this.eApp.relaunch({ args: process.argv.slice(1).concat(['--relaunch']) });
    this.eApp.exit(0);
  }

  /**
   * Gets the application menu.
   * @returns {Menu} The application menu.
   */
  getAppMenu() {
    return this._appMenu;
  }

  /**
   * Gets all registered controllers.
   * @returns {Object} The registered controllers.
   */
  controllers() {
    return this._windowHandlers;
  }

  /**
   * Gets a specific controller by ID.
   * @param {string} controller_id - The ID of the controller.
   * @returns {Object} The controller.
   */
  getController(controller_id) {
    return this._windowHandlers[controller_id];
  }

  /**
   * Adds a new controller.
   * @param {Object} controller - The controller to add.
   */
  addController(controller) {
   return this._windowHandlers[controller.id] = controller;
  }

  /**
   * Checks if a window for a specific controller is open.
   * @param {Object} controller - The controller to check.
   * @returns {boolean} True if the window is open, false otherwise.
   */
  windowOpen(controller) {
    // Ensure controller and controller.id exist before checking
    return controller && controller.id && typeof this._windows[controller.id] !== "undefined";
  }


  /**
   * Reloads a window for a specific controller.
   * @param {Object} controller - The controller to reload.
   */
  reloadWindow(controller) {
    let closed = false;
    if (this.windowOpen(controller)) {
      closed = true;
      this.closeWindow(controller);
    }
    if (closed) {
      this.openWindow(controller);
    }
  }

  /**
   * Closes a window for a specific controller.
   * @param {Object} controller - The controller to close.
   */
  closeWindow(controller) {
    if(this.windowOpen(controller)) {
      this._windows[controller.id].close();
      delete this._windows[controller.id];
    }
  }

  /**
   * Opens a window for a specific controller.
   * @param {Object} controller - The controller to open.
   * @param {Function} [onShow] - Optional callback when window is shown.
   * @returns {BrowserWindow} The created browser window.
   */
  openWindow(controller, onShow) {
  
    if(typeof onShow == "undefined"){
      onShow=function(){};
    }
    
    // Ensure controller and controller.getId() are valid
    if (!controller || typeof controller.getId !== 'function') {
        console.error("Invalid controller passed to openWindow");
        return null; 
    }
    
    const controllerId = controller.getId();

    if (typeof this._windows[controllerId] !== "undefined") {
      this._windows[controllerId].show();
      return this._windows[controllerId];
    }
    
    let defaults = {
      width: 800,
      height: 600,
      show: false,
      // Enable frame for standard window controls in boilerplate
      frame: true, 
      titleBarStyle: 'default', // Use default title bar
      // Remove titleBarOverlay if using default frame
      // titleBarOverlay: {
      //   color: 'rgba(0,0,0,.1)',
      //   symbolColor: '#a2a8ac'
      // },
      autoHideMenuBar: true,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/' + controllerId + '.js'),
        sandbox: false, // Be cautious with sandbox: false in production
        contextIsolation: true, // Recommended for security
        nodeIntegration: false // Recommended for security
      }
    };
    
    let windowSettings = controller.getWindowSettings();
    if (typeof windowSettings !== "undefined") {
      // Merge carefully, especially webPreferences
      defaults = { ...defaults, ...windowSettings, webPreferences: { ...defaults.webPreferences, ...(windowSettings.webPreferences || {}) } };
    }
    
    const mainWindow = new BrowserWindow(defaults);

    mainWindow.on('show', () => {
      onShow();
    });

    // Use 'ready-to-show' for smoother loading
    mainWindow.on('ready-to-show', () => {
      mainWindow.show();
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load window:', {
        controller: controllerId,
        errorCode,
        errorDescription
      });
    });

    // Load the HTML file for the controller
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      // Ensure the URL is correct for Vite dev server
      mainWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${controllerId}.html`);
    } else {
      const filePath = join(__dirname, `../renderer/${controllerId}.html`);
      mainWindow.loadFile(filePath);
    }
    
    this._windows[controllerId] = mainWindow;
    
    // Optional: Open DevTools on F12
    mainWindow.webContents.on('before-input-event', (_, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    });
    
    // Clean up window reference on close
    mainWindow.on('closed', () => {
      delete this._windows[controllerId];
    });
    
    return mainWindow;
  }

  /**
   * Broadcasts a message to all currently open renderer windows.
   * @param {string} channel - The IPC channel name.
   * @param  {...any} args - Arguments to send.
   */
  broadcastToWindows(channel, ...args) {
    console.log(`[Broadcast] Channel: ${channel}, Args:`, args);
    Object.values(this._windows).forEach(window => {
      if (window && !window.isDestroyed() && window.webContents) {
        try {
            window.webContents.send(channel, ...args);
        } catch (error) {
            console.error(`Error sending IPC message to window: ${error}`);
        }
      }
    });
  }
}


// Initialize the GptApp instance
const gptApp = new GptApp(app);

// No need to explicitly call init here, appHandlers takes care of it via app.whenReady()

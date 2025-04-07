import WindowController from '../modules/WindowController.js';
import { ipcMain } from 'electron';

export default class Settings extends WindowController {
  constructor() {
    // Call the super constructor with the controller ID 'settings'
    // and specific window settings for the settings window.
    super('settings', {
      width: 500,
      height: 600,
      resizable: true, // Allow resizing
      // Add any other specific window settings here
    });
  }

  /**
   * Initialization logic specific to the Settings controller.
   * Sets up IPC handlers relevant ONLY to the settings window itself.
   * Core SIP config saving/loading logic should be handled by SipManager via GptApp.
   * @param {GptApp} app - The main application instance.
   */
  onAppReady(app) {
    super.onAppReady(app); // Sets up basic open/close handlers from parent
    this.app = app; // Store reference to the main app instance

    // Example: If settings window needed to directly trigger something in main process
    // ipcMain.handle('settings-specific-action', (event, args) => {
    //   console.log('Settings window action:', args);
    //   // Access app or sipManager via this.app if needed
    //   return 'Settings action acknowledged';
    // });

    console.log('Settings controller is ready.');
  }
}

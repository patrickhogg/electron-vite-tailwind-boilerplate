import WindowController from '../modules/WindowController.js';

export default class Main extends WindowController {
  constructor() {
    // Call the super constructor with the controller ID and optional window settings
    super('main', {
      width: 800,
      height: 600,
      // Add any specific window settings here if needed
    });
  }

  /**
   * Initialization logic specific to this controller when the app is ready.
   * Sets up IPC handlers for this window.
   * @param {GptApp} app - The main application instance.
   */
  onAppReady(app) {
    super.onAppReady(app); // Call the parent's onAppReady method
    this.app = app;

    // Add any IPC handlers specific to the main window here
    // Example:
    // ipcMain.handle('main-do-something', (event, args) => {
    //   console.log('Main window received:', args);
    //   return 'Response from main controller';
    // });
    
    console.log('Main controller is ready.');
  }
}

const { ipcMain } = require('electron');
class WindowController {
  constructor(id,windowSettings) {
    this.id = id;
    this._windowSettings={ width: 800, height: 600 };
    this.webContents=false;
    if(typeof windowSettings !== "undefined"){
      for(let key in windowSettings){
        this._windowSettings[key]=windowSettings[key];
      }
    }
  }
  onAppReady(app){
    this._app=app;
    ipcMain.removeHandler('open-'+this.id);
    ipcMain.removeHandler('close-'+this.id);
    ipcMain.on('open-'+this.id, (event) => {
      this.openWindow();
      this.webContents.on('closed', () => {
        this.webContents=false;
      });
    });
    
    
    ipcMain.on('close-'+this.id, (event) => {
      this.closeWindow();
      
    });
  }
  getWebContents(){
    return this.webContents;
  }
  getId(){
    return this.id;
  }
  getWindowSettings(){
    return this._windowSettings;
  }
  
  openWindow(){
    this.webContents = this._app.openWindow(this);
    return this.webContents;
  }
  closeWindow(){
    this._app.closeWindow(this);
  }
  reloadWindow(){
    this._app.reloadWindow(this);
  }
}
export default WindowController;

# Electron + Vite + Vue + Tailwind Boilerplate

This project serves as a starting point for building cross-platform desktop applications using Electron, Vite, Vue 3, and Tailwind CSS. It provides a basic structure, build configurations, and a simple window management pattern inherited from the `gpt-assistant-builder` project.

## Features

*   **Frameworks:** Electron, Vue 3
*   **Bundler:** Vite (with `electron-vite`)
*   **Styling:** Tailwind CSS
*   **Linting/Formatting:** ESLint, Prettier
*   **Basic Window Management:** Includes `GptApp` and `WindowController` classes for managing application windows.
*   **Hot Reloading:** Enabled for development via Vite.

## Project Structure

```
boiler-plate/
├── electron-builder.yml        # Configuration for electron-builder
├── electron.vite.config.mjs    # Configuration for electron-vite
├── package.json                # Project metadata and dependencies
├── postcss.config.js           # Configuration for PostCSS (used by Tailwind)
├── README.md                   # This file
├── src/
│   ├── main/                   # Main process source code
│   │   ├── controllers/        # Window-specific logic controllers
│   │   │   └── Main.js         # Controller for the main window
│   │   ├── modules/            # Reusable main process modules
│   │   │   └── WindowController.js # Base class for window controllers
│   │   └── main.js             # Main process entry point (GptApp class)
│   ├── preload/                # Preload scripts
│   │   └── main.js             # Preload script for the main window
│   └── renderer/               # Renderer process source code (UI)
│       ├── main.html           # HTML entry point for the main window
│       └── src/
│           ├── assets/         # Static assets (CSS, images, etc.)
│           │   └── base.css    # Base Tailwind CSS setup
│           ├── main.js         # Renderer process entry point (Vue app initialization)
│           └── Main.vue        # Root Vue component for the main window
└── tailwind.config.js        # Configuration for Tailwind CSS
```

## Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Run in Development Mode:**
    This command starts the application with hot reloading enabled for both the main and renderer processes.
    ```bash
    npm run dev
    ```

## Available Scripts

*   `npm run dev`: Starts the application in development mode with hot reloading.
*   `npm run build`: Compiles and bundles the application for production using Vite and Electron Builder.
*   `npm run start`: Runs the production preview build locally (requires `npm run build` first).
*   `npm run lint`: Lints the codebase using ESLint.
*   `npm run format`: Formats the codebase using Prettier.
*   `npm run build:unpack`: Builds an unpackaged version of the application.
*   `npm run build:win`: Builds the application specifically for Windows.
*   `npm run build:mac`: Builds the application specifically for macOS.
*   `npm run build:linux`: Builds the application specifically for Linux.

## Application Architecture

This boilerplate uses Electron's main/renderer process model and includes a basic window management system.

### Main vs. Renderer Process

*   **Main Process (`src/main/`):** Runs in a Node.js environment and is responsible for the application's lifecycle, creating and managing browser windows (`BrowserWindow`), handling system events, and performing background tasks. The entry point is `src/main/main.js`.
*   **Renderer Process (`src/renderer/`):** Runs the web page within a `BrowserWindow`. It's responsible for the user interface (UI). Each window runs its own renderer process. The entry point for the main window is `src/renderer/src/main.js`.
*   **Preload Scripts (`src/preload/`):** Run in a privileged environment before the renderer process's web page loads. They bridge the gap between the main and renderer processes by selectively exposing Node.js/Electron APIs to the renderer via the `contextBridge` (when `contextIsolation` is enabled).

### Window Management (`GptApp` & `WindowController`)

The core window management logic resides in two classes:

1.  **`GptApp` (`src/main/main.js`)**
    *   **Role:** The central orchestrator for the Electron application.
    *   **Responsibilities:**
        *   Initializes the Electron app (`app.whenReady`).
        *   Sets up application lifecycle event handlers (`window-all-closed`, `activate`).
        *   Manages a collection of `WindowController` instances (`_windowHandlers`).
        *   Manages the actual `BrowserWindow` instances (`_windows`).
        *   Provides methods for adding controllers (`addController`), opening windows (`openWindow`), closing windows (`closeWindow`), and retrieving controllers (`getController`).
        *   Initializes controllers via their `onAppReady` method.

2.  **`WindowController` (`src/main/modules/WindowController.js`)**
    *   **Role:** A *base class* designed to be extended by specific window controllers (like `src/main/controllers/Main.js`).
    *   **Purpose:** Provides a standardized way to manage the properties and behavior associated with a specific application window.
    *   **Key Features:**
        *   `constructor(id, windowSettings)`: Takes a unique `id` (used for preload/renderer file naming) and optional `windowSettings` (like width, height) to configure the `BrowserWindow`.
        *   `getId()`: Returns the controller's ID.
        *   `getWindowSettings()`: Returns the configured window settings.
        *   `onAppReady(app)`: A method intended to be called by `GptApp` after the Electron app is ready. This is the ideal place for subclasses to set up IPC handlers (`ipcMain.handle`, `ipcMain.on`) specific to their window using the provided `app` instance (which is the `GptApp` instance).

### Adding New Windows (Pattern)

To add a new window to the application, follow this pattern:

1.  **Create Controller:** Create a new file in `src/main/controllers/` (e.g., `SettingsController.js`) that extends `WindowController`. Define its unique `id` (e.g., 'settings') and any specific `windowSettings`. Implement the `onAppReady` method if needed to handle IPC communication for this window.
2.  **Create Preload Script:** Create a corresponding preload script in `src/preload/` (e.g., `settings.js`). Expose necessary APIs to the renderer using `contextBridge`.
3.  **Create Renderer Files:**
    *   Create an HTML file in `src/renderer/` (e.g., `settings.html`).
    *   Create a Vue component (e.g., `src/renderer/src/Settings.vue`) for the window's UI.
    *   Create a renderer entry point script (e.g., `src/renderer/src/settings.js`) to initialize the Vue app for this window.
4.  **Update Vite Config:** Modify `electron.vite.config.mjs` to include the new preload script and renderer HTML file in the `preload.build.rollupOptions.input` and `renderer.build.rollupOptions.input` sections, respectively.
5.  **Instantiate in `GptApp`:** In `src/main/main.js`, import the new controller and instantiate it within the `GptApp.init()` method using `this.addController(new SettingsController())`. The `GptApp` will automatically call its `onAppReady` method. You can then open the window using `this.openWindow(this.getController('settings'))` when needed.

## Building for Production

To build the application for distribution:

```bash
# Build for the current platform
npm run build

# Or build for specific platforms
npm run build:win
npm run build:mac
npm run build:linux
```

The distributable files will be located in the `dist/` directory.

## License

This project is intended as a boilerplate and does not specify a license by default. Feel free to add your own license file (e.g., `LICENSE.md`).

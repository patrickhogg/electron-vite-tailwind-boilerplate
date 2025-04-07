# Electron + Vite + Vue + Tailwind SIP Softphone

This project is a basic SIP (Session Initiation Protocol) softphone built using Electron, Vite, Vue 3, and Tailwind CSS. It allows users to configure a SIP account, register with a SIP server, and make/receive audio calls.

This project started from a basic Electron/Vite/Vue/Tailwind boilerplate and was extended to include SIP functionality.

## Features

*   **Frameworks:** Electron, Vue 3
*   **Bundler:** Vite (with `electron-vite`)
*   **Styling:** Tailwind CSS (with `@tailwindcss/forms`)
*   **SIP Communication:** Uses `JsSIP` library in the main process.
*   **Window Management:** Custom `GptApp` and `WindowController` classes.
*   **UI:**
    *   Main window with dial pad, call controls, and status display.
    *   Separate settings window for SIP account configuration.
*   **Configuration:** Uses `electron-store` to persist SIP settings.
*   **State Management:** Basic state management within Vue components and the main process `SipManager`.
*   **IPC:** Uses Electron's Inter-Process Communication (`ipcMain`, `ipcRenderer`, `contextBridge`) for communication between main and renderer processes.
*   **Hot Reloading:** Enabled for development via Vite.

## Project Structure

```
boiler-plate/
├── electron-builder.yml        # Configuration for electron-builder
├── electron.vite.config.mjs    # Configuration for electron-vite
├── package.json                # Project metadata and dependencies
├── postcss.config.js           # Configuration for PostCSS (used by Tailwind)
├── README.md                   # This file
├── tailwind.config.js        # Configuration for Tailwind CSS
└── src/
    ├── main/                   # Main process source code
    │   ├── controllers/        # Window-specific logic controllers
    │   │   ├── Main.js         # Controller for the main softphone window
    │   │   └── Settings.js     # Controller for the settings window
    │   ├── modules/
    │   │   ├── SipManager.js   # Core SIP logic (JsSIP, registration, calls)
    │   │   └── WindowController.js # Base class for window controllers
    │   └── main.js             # Main process entry point (GptApp class)
    ├── preload/                # Preload scripts (IPC bridge)
    │   ├── main.js             # Preload script for the main window
    │   └── settings.js         # Preload script for the settings window
    └── renderer/               # Renderer process source code (UI)
        ├── main.html           # HTML entry point for the main window
        ├── settings.html       # HTML entry point for the settings window
        └── src/
            ├── assets/         # Static assets (CSS, images, etc.)
            │   └── base.css    # Base CSS with Tailwind directives
            ├── main.js         # Renderer entry point for main window (Vue init)
            ├── settings.js     # Renderer entry point for settings window (Vue init)
            ├── Main.vue        # Root Vue component for the main softphone UI
            └── Settings.vue    # Root Vue component for the settings UI
```

## Getting Started

1.  **Install Dependencies:**
    Make sure you have Node.js and npm installed.
    ```bash
    npm install
    ```
    This installs Electron, Vue, Vite, Tailwind, JsSIP, electron-store, and other necessary packages.

2.  **Run in Development Mode:**
    This command starts the application with hot reloading enabled for both the main and renderer processes.
    ```bash
    npm run dev
    ```

3.  **Configure SIP Account:**
    *   Click the gear icon (⚙️) in the top-right corner of the main window to open the Settings window.
    *   Enter your SIP server address, username, password, and optionally a display name.
    *   Click "Save & Register".
    *   The status indicator in both windows should update (Connecting... -> Registered/Failed).

4.  **Make/Receive Calls:**
    *   **Make Call:** Enter a number using the dial pad in the main window and click the green phone button.
    *   **Answer Call:** When a call comes in, the display will show "Incoming Call" and the caller ID (if available). Click the green phone button to answer.
    *   **Hang Up/Reject:** Click the red phone button to hang up an active call, cancel an outgoing call, or reject an incoming call.

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

This application uses Electron's main/renderer process model.

### Main vs. Renderer Process

*   **Main Process (`src/main/`):**
    *   Runs in Node.js.
    *   Manages application lifecycle, windows, and system events (`src/main/main.js` - `GptApp`).
    *   Handles all core SIP logic using `JsSIP` via the `SipManager` module (`src/main/modules/SipManager.js`).
    *   Manages SIP configuration persistence using `electron-store`.
    *   Communicates with renderer processes via IPC.
*   **Renderer Process (`src/renderer/`):**
    *   Runs web pages within Electron's `BrowserWindow`.
    *   Responsible for the User Interface (UI), built with Vue 3 and styled with Tailwind CSS.
    *   Two separate renderer processes exist: one for the main softphone window (`Main.vue`) and one for the settings window (`Settings.vue`).
    *   Communicates with the main process via IPC exposed through preload scripts.
*   **Preload Scripts (`src/preload/`):**
    *   Run in a privileged context before the renderer page loads.
    *   Bridge the main and renderer processes securely using `contextBridge`.
    *   Expose specific IPC functions (`invoke`, `send`, `on`) to the renderer under `window.electronAPI`.

### Key Modules & Flow

1.  **`GptApp` (`src/main/main.js`):** Orchestrates the application. Initializes Electron, instantiates window controllers (`Main`, `Settings`), and instantiates the `SipManager`.
2.  **`WindowController` (`src/main/modules/WindowController.js`):** Base class for managing window properties and basic IPC (open/close).
3.  **`Main` / `Settings` Controllers (`src/main/controllers/`):** Extend `WindowController`, defining specific window IDs and settings.
4.  **`SipManager` (`src/main/modules/SipManager.js`):** The heart of the SIP functionality.
    *   Initializes `JsSIP.UA` (User Agent).
    *   Handles loading/saving configuration (`electron-store`).
    *   Manages SIP registration state.
    *   Handles `JsSIP` events (registered, unregistered, newRTCSession, etc.).
    *   Manages call sessions (`RTCSession`).
    *   Provides methods for making, answering, and hanging up calls.
    *   Binds IPC handlers (`settings:get-config`, `settings:save-config`, `sip:make-call`, etc.) to interact with renderers.
    *   Broadcasts status updates (`sip:event:registration-status`, `sip:event:call-state`) to all windows.
5.  **Vue Components (`Main.vue`, `Settings.vue`):**
    *   Render the UI.
    *   Use `window.electronAPI` (exposed by preload scripts) to send commands (e.g., `invoke('sip:make-call', number)`) and receive events (e.g., `on('sip:event:call-state', handler)`).
    *   Update their internal state based on received events to reflect registration status, call state, etc.

### IPC Channels

*   **Renderer -> Main (Invoke/Send):**
    *   `ui:open-settings-window` (Sent from `Main.vue` to `GptApp`)
    *   `settings:get-config` (Sent from `Settings.vue` to `SipManager`)
    *   `settings:save-config` (Sent from `Settings.vue` to `SipManager`)
    *   `sip:get-registration-status` (Sent from `Settings.vue`/`Main.vue` to `SipManager`)
    *   `sip:make-call` (Sent from `Main.vue` to `SipManager`)
    *   `sip:answer-call` (Sent from `Main.vue` to `SipManager`)
    *   `sip:hangup-call` (Sent from `Main.vue` to `SipManager`)
    *   `close-settings` (Sent from `Settings.vue` to `GptApp`)
*   **Main -> Renderer (Broadcast):**
    *   `sip:event:registration-status` (Broadcast from `SipManager`)
    *   `sip:event:call-state` (Broadcast from `SipManager`)
    *   `sip:event:error` (Broadcast from `SipManager`)
    *   `sip:event:remote-stream` (Broadcast from `SipManager` - **Audio handling needs implementation**)
    *   `sip:event:mute-status` (Broadcast from `SipManager`)

## Known Issues / Limitations

*   **Audio Handling:** The most significant limitation is that **remote audio streams are not currently functional**. The `MediaStream` generated by WebRTC in the main process (`SipManager`) needs a proper mechanism to be transferred to and played in the renderer process (`Main.vue`). The current code includes placeholders but requires a specific solution (e.g., dedicated library, manual track transfer, moving JsSIP to renderer).
*   **Error Handling:** Error reporting and handling can be improved.
*   **Call Features:** Advanced features like hold, mute (UI only for now), transfer, multiple calls, video calls are not implemented.
*   **UI/UX:** The UI is basic and could be significantly enhanced.
*   **Transport:** Assumes WSS transport for SIP; should be configurable.
*   **Security:** Storing passwords with `electron-store` is basic. Consider more secure storage mechanisms for production.

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

This project is intended as a demonstration and does not specify a license by default. Feel free to add your own license file (e.g., `LICENSE.md`).

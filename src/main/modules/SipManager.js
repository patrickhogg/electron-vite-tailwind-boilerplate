// Polyfill WebSocket for Node.js environment BEFORE importing JsSIP
import { WebSocket } from 'ws';
global.WebSocket = WebSocket;

import * as JsSIP from 'jssip';
// Remove static import: import Store from 'electron-store';
import { ipcMain } from 'electron'; // Needed if we handle specific IPC calls directly here

// Enable JsSIP debug logs
JsSIP.debug.enable('JsSIP:*');

// Define default configuration structure
const defaultConfig = {
    server: '',
    port: null, // Let JsSIP decide default based on transport if null
    username: '',
    password: '',
    displayName: '',
    transport: 'WSS', // Default to WSS (secure websocket)
    // Add other JsSIP configuration options as needed
    // e.g., register_expires: 600, use_preloaded_route: false, etc.
};

export default class SipManager {
    constructor(app) {
        this.app = app; // Reference to the main GptApp instance for broadcasting
        this.store = null; // Initialize store as null
        this.config = { ...defaultConfig }; // Start with defaults
        this.ua = null; // JsSIP User Agent instance
        this.currentSession = null; // Active call session
        this.registrationStatus = 'Unregistered';
        this.callState = 'Idle'; // Idle, Calling, Ringing, Incoming, Active, Held, Ended

        console.log('[SipManager] Initialized. Loaded config:', this.config);

        // Automatically try to register if config seems valid on startup
        if (this.config.server && this.config.username && this.config.password) {
             console.log('[SipManager] Attempting initial registration based on stored config.');
             this.startUA();
        } else {
             console.log('[SipManager] Initial configuration missing, skipping auto-registration.');
        }

        // Bind IPC handlers previously in GptApp to this manager
        this.bindIpcHandlers();

        // Initialize asynchronously
        this.initialize();
    }

    /**
     * Asynchronously initializes the SipManager, loading the store and config.
     */
    async initialize() {
        try {
            console.log('[SipManager] Initializing asynchronously...');
            const { default: Store } = await import('electron-store');
            this.store = new Store({ name: 'sip-config' });
            console.log('[SipManager] Electron-store loaded.');
            this.config = this.loadConfig(); // Load config after store is initialized
            console.log('[SipManager] Initialized. Loaded config:', this.config);

            // Automatically try to register if config seems valid on startup
            if (this.config.server && this.config.username && this.config.password) {
                console.log('[SipManager] Attempting initial registration based on stored config.');
                this.startUA();
            } else {
                console.log('[SipManager] Initial configuration missing, skipping auto-registration.');
            }
        } catch (error) {
            console.error('[SipManager] Failed to initialize electron-store:', error);
            // Handle error appropriately - maybe broadcast an error state?
            this.updateRegistrationStatus('Init Error');
        }
    }

    /**
     * Loads configuration from persistent storage.
     * Should only be called after this.store is initialized.
     */
    loadConfig() {
        if (!this.store) {
            console.error('[SipManager] Attempted to load config before store was initialized.');
            return { ...defaultConfig }; // Return defaults if store isn't ready
        }
        const storedConfig = this.store.get('sipConfig');
        // Merge stored config with defaults to ensure all keys exist
        return { ...defaultConfig, ...(storedConfig || {}) };
    }

    /**
     * Saves configuration to persistent storage.
     * Should only be called after this.store is initialized.
     */
    saveConfig(newConfig) {
        if (!this.store) {
            console.error('[SipManager] Attempted to save config before store was initialized.');
            return; // Do nothing if store isn't ready
        }
        this.config = { ...defaultConfig, ...newConfig };
        this.store.set('sipConfig', this.config);
        console.log('[SipManager] Configuration saved:', this.config);
    }

    /**
    * Binds IPC handlers related to SIP and settings.
    */
    bindIpcHandlers() {
        ipcMain.handle('settings:get-config', async () => {
            console.log('[SipManager IPC] Handling settings:get-config');
            return this.getConfig();
        });

        ipcMain.handle('settings:save-config', async (event, config) => {
            console.log('[SipManager IPC] Handling settings:save-config', config);
            return this.updateConfigAndRegister(config);
        });

        ipcMain.handle('sip:get-registration-status', async () => {
            console.log('[SipManager IPC] Handling sip:get-registration-status');
            return this.getRegistrationStatus();
        });

        ipcMain.handle('sip:make-call', async (event, number) => {
             console.log(`[SipManager IPC] Handling sip:make-call to ${number}`);
             return this.makeCall(number);
        });

        ipcMain.handle('sip:answer-call', async () => {
             console.log('[SipManager IPC] Handling sip:answer-call');
             return this.answerCall();
        });

        ipcMain.handle('sip:hangup-call', async () => {
             console.log('[SipManager IPC] Handling sip:hangup-call');
             return this.hangupCall();
        });

        // Add handlers for hold, mute, etc. later
    }


    /**
     * Returns the current configuration.
     */
    getConfig() {
        return this.config;
    }

    /**
     * Returns the current registration status.
     */
    getRegistrationStatus() {
        return this.registrationStatus;
    }

     /**
     * Returns the current call state.
     */
    getCallState() {
        // TODO: Implement detailed call state tracking
        return this.callState;
    }

    /**
     * Updates the configuration, saves it, and attempts to stop the old UA (if running)
     * and start a new one with the new settings.
     * @param {object} newConfig - The new configuration object.
     */
    async updateConfigAndRegister(newConfig) {
        console.log('[SipManager] Updating config and restarting UA.');
        this.saveConfig(newConfig);
        // Broadcast the config update so renderers (like Main.vue for audio output) can react
        this.app.broadcastToWindows('sip:event:config-updated', this.config);
        await this.stopUA(); // Stop existing UA if any
        return this.startUA(); // Start new UA with updated config
    }

    /**
     * Starts the JsSIP User Agent and connects.
     */
    startUA() {
         if (this.ua && this.ua.isRegistered()) {
            console.log('[SipManager] UA already started and registered.');
            return true;
         }
         if (this.ua && this.ua.isConnecting()) {
             console.log('[SipManager] UA is already connecting.');
             return true;
         }

        if (!this.config.server || !this.config.username || !this.config.password) {
            console.error('[SipManager] Cannot start UA: Configuration is incomplete.');
            this.updateRegistrationStatus('Config Error');
            return false;
        }

        try {
            // Determine protocol and default port based on config.transport
            const transport = this.config.transport?.toUpperCase() || 'WSS'; // Default to WSS
            const protocol = transport === 'WSS' ? 'wss' : 'ws';
            const defaultPort = transport === 'WSS' ? 443 : 80; // Standard default ports
            const port = this.config.port || defaultPort;
            const serverAddress = `${protocol}://${this.config.server}:${port}`;

            console.log(`[SipManager] Attempting to connect WebSocket to: ${serverAddress}`);

            const socketOptions = {};
            // If using WSS with a self-signed cert, might need to reject unauthorized
            // IMPORTANT: This bypasses certificate validation - ONLY use if you TRUST the server
            // and understand the security implications. DO NOT use for public servers.
            if (protocol === 'wss' /* && this.config.allowSelfSignedCert */) {
                 // socketOptions.rejectUnauthorized = false; // Example: Add this if needed
            }

            const socket = new JsSIP.WebSocketInterface(serverAddress, socketOptions);

            const configuration = {
                sockets: [socket],
                uri: `sip:${this.config.username}@${this.config.server}`,
                password: this.config.password,
                display_name: this.config.displayName || this.config.username,
                // Add other JsSIP options from this.config if needed
                // register_expires: this.config.register_expires || 600,
            };

            console.log('[SipManager] Starting JsSIP UA with configuration:', configuration);
            this.updateRegistrationStatus('Connecting...');

            this.ua = new JsSIP.UA(configuration);

            // --- UA Event Listeners ---
            this.ua.on('connecting', () => {
                console.log('[JsSIP UA] Connecting...');
                this.updateRegistrationStatus('Connecting...');
            });

            this.ua.on('connected', () => {
                console.log('[JsSIP UA] Connected (WebSocket).');
                 this.updateRegistrationStatus('Connected'); // Intermediate state
            });

            this.ua.on('disconnected', () => {
                console.log('[JsSIP UA] Disconnected (WebSocket).');
                // Only set to Unregistered if not already handled by registrationFailed
                if (this.registrationStatus !== 'Failed' && this.registrationStatus !== 'Unregistered') {
                   this.updateRegistrationStatus('Unregistered');
                }
                this.stopUA(); // Clean up UA instance on disconnect
            });

            this.ua.on('registered', (data) => {
                console.log('[JsSIP UA] Registered.', data);
                this.updateRegistrationStatus('Registered');
            });

            this.ua.on('unregistered', (data) => {
                console.log('[JsSIP UA] Unregistered.', data);
                // Check cause if needed: data.response, data.cause
                this.updateRegistrationStatus('Unregistered');
                 // Optionally stop UA here if unregistration wasn't intentional
            });

            this.ua.on('registrationFailed', (data) => {
                console.error('[JsSIP UA] Registration Failed.', data);
                // Check cause: data.response, data.cause
                this.updateRegistrationStatus(`Failed (${data.cause || 'Unknown'})`);
                this.stopUA(); // Stop UA on registration failure
            });

            this.ua.on('newRTCSession', (data) => {
                console.log('[JsSIP UA] New RTC Session:', data);
                // data.originator ('local' or 'remote')
                // data.session (the JsSIP.RTCSession instance)
                // data.request (the incoming INVITE request)

                if (this.currentSession) {
                    console.warn('[SipManager] Incoming call while another session is active. Rejecting.');
                    data.session.terminate({ status_code: 486, reason_phrase: 'Busy Here' });
                    return;
                }

                this.currentSession = data.session;
                this.setupSessionEventHandlers(this.currentSession);

                if (data.originator === 'remote') {
                    const callerId = data.session.remote_identity.uri.toString();
                    console.log(`[SipManager] Incoming call from ${callerId}`);
                    this.updateCallState('Incoming', { callerId });
                    // Renderer should now show incoming call UI and offer Answer/Reject
                } else {
                     // Originator is 'local', we initiated the call
                     this.updateCallState('Calling');
                }
            });

            this.ua.start();
            return true;

        } catch (error) {
            console.error('[SipManager] Error starting JsSIP UA:', error);
            this.updateRegistrationStatus(`Error: ${error.message}`);
            this.ua = null; // Ensure UA is null on error
            return false;
        }
    }

    /**
     * Stops the JsSIP User Agent.
     */
    async stopUA() {
        if (this.ua) {
            console.log('[SipManager] Stopping JsSIP UA...');
            // Unregister explicitly if registered
            if (this.ua.isRegistered()) {
                 this.ua.unregister(); // Let the 'unregistered' event handle status update
            }
            // Stop the UA gracefully
            this.ua.stop();
            this.ua = null; // Clear the instance
            this.currentSession = null; // Clear any active session reference
            // Update status only if it wasn't already unregistered/failed
            if (this.registrationStatus !== 'Unregistered' && this.registrationStatus !== 'Failed') {
                 this.updateRegistrationStatus('Unregistered');
            }
             this.updateCallState('Idle'); // Reset call state
            console.log('[SipManager] JsSIP UA stopped.');
        } else {
             console.log('[SipManager] UA already stopped.');
        }
    }

    /**
     * Sets up event handlers for a new call session.
     * @param {JsSIP.RTCSession} session
     */
    setupSessionEventHandlers(session) {
        session.on('peerconnection', (data) => {
            console.log('[RTCSession] PeerConnection created:', data);
            // Access peerconnection: data.peerconnection
            // Setup handlers for tracks, ICE connection state, etc. if needed
             data.peerconnection.ontrack = (event) => {
                console.log('[PeerConnection] Track received:', event.track, event.streams);
                // Attach remote stream to audio element in renderer via IPC
                // This is complex - might need to pass stream info or use specific Electron APIs
                this.app.broadcastToWindows('sip:event:remote-stream', { streamInfo: 'placeholder' }); // Placeholder
            };
        });

        session.on('connecting', () => {
            console.log('[RTCSession] Connecting...');
            // Update call state if needed (might already be 'Calling' or 'Incoming')
        });

        session.on('accepted', (data) => {
            console.log('[RTCSession] Call Accepted.', data);
            this.updateCallState('Active');
        });

        session.on('confirmed', (data) => {
            console.log('[RTCSession] Call Confirmed (ACK received/sent).', data);
             // Often considered the point the call is truly 'Active'
             this.updateCallState('Active');
        });

         session.on('hold', (data) => {
            console.log('[RTCSession] Call Hold.', data);
            // data.originator ('local' or 'remote')
            this.updateCallState(data.originator === 'local' ? 'Held' : 'RemoteHold');
        });

        session.on('unhold', (data) => {
            console.log('[RTCSession] Call Unhold.', data);
             // data.originator ('local' or 'remote')
            this.updateCallState('Active'); // Back to active after unhold
        });

        session.on('muted', (data) => {
            console.log('[RTCSession] Call Muted.', data);
            // Inform renderer if needed
             this.app.broadcastToWindows('sip:event:mute-status', { muted: true });
        });

        session.on('unmuted', (data) => {
            console.log('[RTCSession] Call Unmuted.', data);
             // Inform renderer if needed
             this.app.broadcastToWindows('sip:event:mute-status', { muted: false });
        });

        session.on('ended', (data) => {
            console.log('[RTCSession] Call Ended.', data);
             // data.originator ('local', 'remote', 'system')
             // data.message (SIP message that ended the call)
             // data.cause (e.g., 'Terminated', 'Canceled', 'Rejected', 'Busy', etc.)
            this.updateCallState('Ended', { cause: data.cause });
            this.currentSession = null; // Clear the current session
             // Transition back to Idle after a short delay? Or let UI handle it.
             setTimeout(() => this.updateCallState('Idle'), 1000); // Reset to Idle after 1s
        });

        session.on('failed', (data) => {
            console.error('[RTCSession] Call Failed.', data);
             // data.originator ('local', 'remote', 'system')
             // data.message (SIP message if available)
             // data.cause
            this.updateCallState('Failed', { cause: data.cause });
            this.currentSession = null; // Clear the current session
            setTimeout(() => this.updateCallState('Idle'), 1000); // Reset to Idle after 1s
        });
    }

    /**
     * Initiates an outgoing call.
     * @param {string} target - The number/SIP URI to call.
     */
    makeCall(target) {
        if (!this.ua || !this.ua.isRegistered()) {
            console.error('[SipManager] Cannot make call: UA not registered.');
            this.app.broadcastToWindows('sip:event:error', 'Not registered. Cannot make call.');
            return false;
        }
        if (this.currentSession) {
             console.error('[SipManager] Cannot make call: Another call is already active.');
             this.app.broadcastToWindows('sip:event:error', 'Another call is active.');
             return false;
        }

        const targetUri = `sip:${target}@${this.config.server}`; // Construct target URI
        console.log(`[SipManager] Attempting to call ${targetUri}`);

        // Construct media constraints using selected input device
        const audioConstraint = this.config.audioInputDeviceId && this.config.audioInputDeviceId !== 'default'
            ? { deviceId: { exact: this.config.audioInputDeviceId } }
            : true; // Use default device if not specified

        const options = {
            'eventHandlers': {}, // We set handlers via .on() on the session later
            'mediaConstraints': { 'audio': audioConstraint, 'video': false }, // Audio only call
            // Add other options like extraHeaders if needed
        };

        try {
            const session = this.ua.call(targetUri, options);
            // 'newRTCSession' event will fire, setting this.currentSession
            // and setting up event handlers. Call state becomes 'Calling'.
             return true;
        } catch (error) {
            console.error('[SipManager] Error initiating call:', error);
             this.updateCallState('Failed', { cause: 'Call Initiation Error' });
             setTimeout(() => this.updateCallState('Idle'), 1000);
             this.app.broadcastToWindows('sip:event:error', `Call failed: ${error.message}`);
             return false;
        }
    }

    /**
     * Answers the current incoming call.
     */
    answerCall() {
        if (!this.currentSession || this.callState !== 'Incoming') {
            console.error('[SipManager] Cannot answer call: No active incoming session.');
             this.app.broadcastToWindows('sip:event:error', 'No incoming call to answer.');
            return false;
        }

        console.log('[SipManager] Answering incoming call...');

        // Construct media constraints using selected input device
        const audioConstraint = this.config.audioInputDeviceId && this.config.audioInputDeviceId !== 'default'
            ? { deviceId: { exact: this.config.audioInputDeviceId } }
            : true; // Use default device if not specified

        const options = {
            'mediaConstraints': { 'audio': audioConstraint, 'video': false }
        };
        this.currentSession.answer(options);
        // Call state will transition via session event handlers ('accepted', 'confirmed')
        return true;
    }

    /**
     * Hangs up the current call (incoming ringing, outgoing calling, or active).
     */
    hangupCall() {
        if (!this.currentSession) {
            console.error('[SipManager] Cannot hangup call: No active session.');
            this.app.broadcastToWindows('sip:event:error', 'No active call to hangup.');
            return false;
        }

        console.log('[SipManager] Hanging up call...');
        if (this.currentSession.isEnded()) {
             console.log('[SipManager] Call already ended.');
             return false; // Already ended
        }

        try {
            // Determine appropriate termination method based on state
            if (this.callState === 'Incoming' || this.callState === 'Ringing') {
                 this.currentSession.terminate({ status_code: 603, reason_phrase: 'Decline' }); // Reject incoming
            } else if (this.callState === 'Calling') {
                 this.currentSession.terminate({ status_code: 487, reason_phrase: 'Request Terminated' }); // Cancel outgoing
            } else {
                 this.currentSession.terminate(); // Standard hangup for active/held calls
            }
             // State transition handled by 'ended'/'failed' event
             return true;
        } catch (error) {
             console.error('[SipManager] Error during hangup:', error);
              this.app.broadcastToWindows('sip:event:error', `Hangup failed: ${error.message}`);
             // Force state update if terminate fails?
             this.updateCallState('Failed', { cause: 'Hangup Error' });
             this.currentSession = null;
             setTimeout(() => this.updateCallState('Idle'), 1000);
             return false;
        }
    }

    // --- Helper Methods ---

    /**
     * Updates the registration status and broadcasts it.
     * @param {string} status - The new status string.
     */
    updateRegistrationStatus(status) {
        if (this.registrationStatus !== status) {
            console.log(`[SipManager] Registration status changed: ${this.registrationStatus} -> ${status}`);
            this.registrationStatus = status;
            this.app.broadcastToWindows('sip:event:registration-status', this.registrationStatus);
        }
    }

     /**
     * Updates the call state and broadcasts it.
     * @param {string} state - The new state string.
     * @param {object} [details={}] - Optional details (e.g., callerId, cause).
     */
    updateCallState(state, details = {}) {
         if (this.callState !== state || JSON.stringify(this.lastCallDetails) !== JSON.stringify(details)) {
            console.log(`[SipManager] Call state changed: ${this.callState} -> ${state}`, details);
            this.callState = state;
            this.lastCallDetails = details; // Store details for comparison
            this.app.broadcastToWindows('sip:event:call-state', { state: this.callState, ...details });
         }
    }
}

// REMOVED: import Store from 'electron-store';
import twilio from 'twilio';

// Define default configuration structure
const defaultConfig = {
  accountSid: '',
  apiKeySid: '',    // Using API Key/Secret is generally preferred over Auth Token
  // apiKeySecret: '', // Secret is stored in keytar, not here
  functionUrl: '', // URL of the Twilio Function handling calls
  twimlAppSid: '',  // SID of the TwiML App (will be auto-managed)
  selectedPhoneNumber: '', // The full phone number string (+1...)
  selectedPhoneNumberSid: '', // The SID of the selected phone number (PN...)
  audioInputDeviceId: 'default',
  audioOutputDeviceId: 'default'
};

const AUTO_TWIML_APP_FRIENDLY_NAME = 'Electron Softphone Auto-App'; // Name for auto-created TwiML App

// *** ADD VERSION LOGGING ***
const TWILIO_MANAGER_CODE_VERSION = 'REFACTORED_V4'; // Updated version marker AGAIN
console.log(`*** Loading TwilioManager Module - Code Version: ${TWILIO_MANAGER_CODE_VERSION} ***`);

export default class TwilioManager {
  constructor(app) {
    this.app = app;
    this.store = null; // Initialize store as null
    this.config = { ...defaultConfig }; // Start with defaults
    this.twilioClient = null;
    // Initialization logic moved to async initialize method
  }

  /**
   * Asynchronously initializes the manager, loading the store and config.
   * Must be called after instantiation.
   */
  async initialize() {
    console.log('[TwilioManager] Initializing asynchronously...');
    try {
        // Dynamically import electron-store
        const { default: Store } = await import('electron-store');
        this.store = new Store({
            name: 'twilio-config',
            defaults: defaultConfig
        });
        console.log(`[TwilioManager] Electron-store initialized. Path: ${this.store.path}`);
        this.config = this.loadConfig(); // Load config after store is initialized
        await this.initializeClient(); // Initialize Twilio client after config is loaded
        console.log('[TwilioManager] Initialized successfully.');
    } catch (error) {
        console.error('[TwilioManager] Failed to initialize electron-store:', error);
        this.store = null;
        this.config = { ...defaultConfig }; // Reset config to defaults on error
    }
  }

  /**
   * Loads configuration from persistent storage.
   * Should only be called after this.store is initialized.
   */
  loadConfig() {
    if (!this.store) {
        console.error('[TwilioManager] Attempted to load config before store was initialized.');
        return { ...defaultConfig };
    }
    const storedConfig = this.store.store;
    console.log('[TwilioManager loadConfig] Config read from store:', storedConfig);
    // Ensure all default keys exist by merging defaults with stored data
    // Exclude apiKeySecret explicitly as it should not be in the store
    const { apiKeySecret, ...safeStoredConfig } = storedConfig;
    return { ...defaultConfig, ...safeStoredConfig };
  }

  /**
   * Saves configuration changes to memory and persistent storage.
   * Should only be called after this.store is initialized.
   */
  saveConfig(keyOrObject, value) {
    if (!this.store) {
        console.error('*** FATAL: Attempted to save config, but this.store is not initialized! ***');
        return;
    }

    // Update the in-memory config object first
    let configChanged = false;
    if (typeof keyOrObject === 'object') {
        // Merge the provided object into the current config
        // Ensure we don't accidentally save the secret here
        const { apiKeySecret, ...safeObjectToMerge } = keyOrObject;
        this.config = { ...this.config, ...safeObjectToMerge };
        configChanged = true; // Assume change if object is passed
    } else if (typeof keyOrObject === 'string') {
        // Update a single key in the current config
        if (keyOrObject !== 'apiKeySecret') { // Prevent saving secret directly
             this.config[keyOrObject] = value;
             configChanged = true;
        } else {
            console.warn('[TwilioManager saveConfig] Attempted to save apiKeySecret directly to config. Ignoring.');
        }
    } else {
        console.error('[TwilioManager] Invalid arguments for saveConfig');
        return;
    }

    // Save the entire current config (excluding secret) to the store
    try {
        console.log('[TwilioManager saveConfig] Saving current config to store (secret excluded):', this.config);
        this.store.set(this.config); // Save the entire object (secret should not be present)
        console.log('[TwilioManager saveConfig] store.set() completed.');
    } catch (error) {
        console.error('[TwilioManager saveConfig] Error during store.set:', error);
    }

    // Re-initialize client if relevant credentials changed
    const credsToCheck = ['accountSid', 'apiKeySid'];
    let credsChanged = false;
    if (typeof keyOrObject === 'object') {
        credsChanged = credsToCheck.some(key => key in keyOrObject);
    } else if (typeof keyOrObject === 'string') {
        credsChanged = credsToCheck.includes(keyOrObject);
    }

    if (credsChanged) {
        console.log('[TwilioManager saveConfig] Credentials changed, re-initializing client...');
        this.initializeClient();
    }
  }

  /**
   * Initializes the Twilio REST API client if credentials are available.
   * Uses keytar to securely store/retrieve the API Key Secret.
   */
  async initializeClient() {
    console.log('[initializeClient] Attempting to initialize client...');
    const { accountSid, apiKeySid } = this.config;
    if (accountSid && apiKeySid) {
      console.log(`[initializeClient] Found accountSid: ${accountSid}, apiKeySid: ${apiKeySid}`);
      try {
        console.log('[initializeClient] Importing keytar...');
        const { default: keytar } = await import('keytar');
        console.log('[initializeClient] Keytar imported.');
        const service = 'ElectronSoftphoneTwilio';
        console.log(`[initializeClient] Attempting to get password from keytar (Service: ${service}, Account: ${apiKeySid})`);
        const apiKeySecret = await keytar.getPassword(service, apiKeySid);

        if (!apiKeySecret) {
            console.warn('[initializeClient] API Key Secret NOT FOUND in keychain for service/account.');
            this.twilioClient = null;
            return;
        }
        console.log('[initializeClient] API Key Secret retrieved successfully from keychain.');

        console.log('[initializeClient] Attempting to instantiate Twilio client...');
        this.twilioClient = twilio(apiKeySid, apiKeySecret, { accountSid: accountSid });
        console.log('[initializeClient] Twilio REST Client Initialized successfully.');
      } catch (error) {
        console.error('[initializeClient] ERROR during client initialization:', error);
        this.twilioClient = null;
      }
    } else {
      console.warn(`[initializeClient] Initialization skipped: accountSid (${accountSid}) or apiKeySid (${apiKeySid}) is missing.`);
      this.twilioClient = null;
    }
  }

  /**
   * Checks if essential configuration items are stored.
   * @returns {boolean} True if credentials and URL seem to be configured.
   */
  getCredentialsStatus() {
    // Checks Account SID, API Key SID (implies secret is in keytar), and Function URL.
    const isConfigured = !!(this.config.accountSid && this.config.apiKeySid && this.config.functionUrl);
    console.log(`[getCredentialsStatus] Checking: accountSid=${!!this.config.accountSid}, apiKeySid=${!!this.config.apiKeySid}, functionUrl=${!!this.config.functionUrl} -> Result: ${isConfigured}`);
    return isConfigured;
  }

  /**
   * Checks if the configuration is complete enough to generate a token.
   * Requires Account SID, API Key SID (to fetch secret), and TwiML App SID.
   * @returns {boolean} True if ready for token generation.
   */
  isReadyForToken() {
      const ready = !!(this.config.accountSid && this.config.apiKeySid && this.config.twimlAppSid);
      console.log(`[isReadyForToken] Checking: accountSid=${!!this.config.accountSid}, apiKeySid=${!!this.config.apiKeySid}, twimlAppSid=${!!this.config.twimlAppSid} -> Result: ${ready}`);
      return ready;
  }

  /**
   * Generates a Twilio Access Token for the Voice SDK.
   * @param {string} identity - The client identity for this token.
   * @returns {Promise<string|null>} The JWT token or null on error.
   */
  async generateAccessToken(identity) {
    // Use the corrected check
    if (!this.isReadyForToken()) {
      console.error('[TwilioManager generateAccessToken] Cannot generate token: Configuration incomplete (check Account SID, API Key SID, TwiML App SID).');
      return null;
    }
    if (!identity) {
        console.error('[TwilioManager generateAccessToken] Cannot generate token: Identity is required.');
        return null;
    }

    console.log(`[TwilioManager generateAccessToken] Generating Access Token for identity: ${identity}`);

    // Fetch the secret from keytar
    let apiKeySecret;
    try {
        console.log('[generateAccessToken] Importing keytar...');
        const { default: keytar } = await import('keytar');
        console.log(`[generateAccessToken] Attempting to get password from keytar (Service: ElectronSoftphoneTwilio, Account: ${this.config.apiKeySid})`);
        apiKeySecret = await keytar.getPassword('ElectronSoftphoneTwilio', this.config.apiKeySid);
        if (!apiKeySecret) {
            throw new Error('API Key Secret not found in keychain.');
        }
        console.log('[generateAccessToken] API Key Secret retrieved successfully.');
    } catch (keytarError) {
        console.error('[TwilioManager generateAccessToken] Error retrieving API Key Secret from keytar:', keytarError);
        return null; // Cannot generate token without secret
    }

    try {
      // Use correct constructor path and the retrieved secret
      const AccessToken = twilio.jwt.AccessToken;
      const VoiceGrant = AccessToken.VoiceGrant;

      const accessToken = new AccessToken(
        this.config.accountSid,
        this.config.apiKeySid,
        apiKeySecret, // Use secret from keytar
        { identity: identity, ttl: 3600 } // Token valid for 1 hour
      );

      const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: this.config.twimlAppSid,
        incomingAllow: true // Allow incoming calls for this identity
      });
      accessToken.addGrant(voiceGrant);

      const token = accessToken.toJwt();
      console.log('[TwilioManager generateAccessToken] Access Token generated successfully.');
      return token;
    } catch (error) {
      console.error('[TwilioManager generateAccessToken] Error generating Access Token:', error);
      return null;
    }
  }

  /**
   * Lists available incoming phone numbers from the Twilio account.
   * Uses temporary client if provided, otherwise uses the initialized client.
   * @param {object|null} tempCredentials - Optional temporary credentials { accountSid, apiKeySid, apiKeySecret }.
   * @returns {Promise<Array<{phoneNumber: string, sid: string}>>} List of numbers or empty array on error.
   */
  async listPhoneNumbers(tempCredentials = null) {
      let clientToUse = this.twilioClient;
      let temporaryClient = false;

      // If tempCredentials are provided, try to create a temporary client
      if (tempCredentials && tempCredentials.accountSid && tempCredentials.apiKeySid && tempCredentials.apiKeySecret) {
          try {
              console.log('[TwilioManager listPhoneNumbers] Creating temporary client...');
              clientToUse = twilio(tempCredentials.apiKeySid, tempCredentials.apiKeySecret, { accountSid: tempCredentials.accountSid });
              temporaryClient = true;
          } catch (error) {
              console.error('[TwilioManager listPhoneNumbers] Failed to create temporary client:', error);
              // Return structure expected by caller
              return { success: false, numbers: [], error: 'Failed to initialize temporary client with provided credentials.' };
          }
      }

      // If no client (neither permanent nor temporary) is available, fail
      if (!clientToUse) {
          console.error('[TwilioManager listPhoneNumbers] Cannot list numbers: No Twilio client available.');
          return { success: false, numbers: [], error: 'Twilio client not initialized. Check credentials.' };
      }

      console.log(`[TwilioManager listPhoneNumbers] Fetching phone numbers using ${temporaryClient ? 'temporary' : 'permanent'} client...`);
      try {
        const numbers = await clientToUse.incomingPhoneNumbers.list({ limit: 100 });
        console.log(`[TwilioManager listPhoneNumbers] Found ${numbers.length} phone numbers.`);
        return { success: true, numbers: numbers.map(num => ({ phoneNumber: num.phoneNumber, sid: num.sid })) };
      } catch (error) {
        console.error('[TwilioManager listPhoneNumbers] Error listing phone numbers:', error);
        const errorMessage = (error.status === 401)
            ? 'Authentication failed. Check Account SID and API Key/Secret.'
            : `Error listing phone numbers: ${error.message}`;
        return { success: false, numbers: [], error: errorMessage };
      }
  }


  /**
   * Updates a phone number's configuration to use the TwiML App.
   * @param {string} phoneNumberSid - The SID of the phone number (PN...).
   * @returns {Promise<boolean>} True on success, false on failure.
   */
  async configurePhoneNumber(phoneNumberSid) {
     if (!this.twilioClient) {
      console.error('[TwilioManager configurePhoneNumber] Cannot configure number: Twilio client not initialized.');
      return false;
    }
     if (!phoneNumberSid) {
        console.error('[TwilioManager configurePhoneNumber] Cannot configure number: Phone Number SID is required.');
        return false;
     }
     if (!this.config.twimlAppSid) {
        console.error('[TwilioManager configurePhoneNumber] Cannot configure number: TwiML App SID is not configured.');
        return false;
     }

    console.log(`[TwilioManager configurePhoneNumber] Configuring ${phoneNumberSid} to use TwiML App ${this.config.twimlAppSid}`);
    try {
      await this.twilioClient.incomingPhoneNumbers(phoneNumberSid)
        .update({
          voiceApplicationSid: this.config.twimlAppSid,
          voiceUrl: '', // Explicitly clear webhook URLs
          voiceMethod: 'POST',
          statusCallback: '',
          statusCallbackMethod: 'POST'
        });
      console.log(`[TwilioManager configurePhoneNumber] Successfully configured ${phoneNumberSid}.`);
      return true;
    } catch (error) {
      console.error(`[TwilioManager configurePhoneNumber] Error configuring ${phoneNumberSid}:`, error);
      return false;
    }
  }

  /**
   * Finds an existing TwiML App by friendly name or creates a new one.
   * Updates the app's VoiceUrl if needed.
   * @param {string} functionUrl - The URL of the Twilio Function to handle calls.
   * @returns {Promise<string|null>} The SID of the found/created/updated TwiML App, or null on error.
   */
  async findOrCreateTwiMLApp(functionUrl) {
    if (!this.twilioClient) {
      console.error('[TwilioManager findOrCreateTwiMLApp] Cannot proceed: Twilio client not initialized.');
      return null;
    }
    if (!functionUrl) {
        console.error('[TwilioManager findOrCreateTwiMLApp] Cannot proceed: Function URL is required.');
        return null;
    }

    const friendlyName = AUTO_TWIML_APP_FRIENDLY_NAME;
    console.log(`[TwilioManager findOrCreateTwiMLApp] Finding or creating TwiML App named: ${friendlyName}`);

    try {
      const apps = await this.twilioClient.applications.list({ friendlyName: friendlyName, limit: 1 });

      if (apps.length > 0) {
        const app = apps[0];
        console.log(`[TwilioManager findOrCreateTwiMLApp] Found existing TwiML App SID: ${app.sid}`);
        if (app.voiceUrl !== functionUrl || app.voiceMethod !== 'POST') {
          console.log(`[TwilioManager findOrCreateTwiMLApp] Updating TwiML App ${app.sid} Voice URL to: ${functionUrl}`);
          await this.twilioClient.applications(app.sid).update({
            voiceUrl: functionUrl,
            voiceMethod: 'POST'
          });
          console.log(`[TwilioManager findOrCreateTwiMLApp] TwiML App ${app.sid} updated.`);
        }
        return app.sid;
      } else {
        console.log(`[TwilioManager findOrCreateTwiMLApp] TwiML App not found. Creating new one...`);
        const newApp = await this.twilioClient.applications.create({
          friendlyName: friendlyName,
          voiceUrl: functionUrl,
          voiceMethod: 'POST'
        });
        console.log(`[TwilioManager findOrCreateTwiMLApp] Created new TwiML App SID: ${newApp.sid}`);
        return newApp.sid;
      }
    } catch (error) {
      console.error(`[TwilioManager findOrCreateTwiMLApp] Error finding or creating TwiML App:`, error);
      return null;
    }
  }

   /**
    * Gets the currently selected phone number string.
    * @returns {string} The selected phone number string or empty string.
    */
   getSelectedNumberString() {
       return this.config.selectedPhoneNumber || '';
   }

   /**
    * Gets the currently stored configuration (excluding secret).
    */
   getConfig() {
       // Return a copy to prevent direct modification
       return { ...this.config };
   }


  /**
   * Binds all necessary IPC handlers.
   * @param {Electron.IpcMain} ipcMain - The ipcMain instance.
   */
  bindIpcHandlers(ipcMain) {
    console.log('[TwilioManager] Binding IPC Handlers...');

    ipcMain.handle('twilio:get-credentials-status', async () => {
      console.log('[IPC] Handling twilio:get-credentials-status');
      return this.getCredentialsStatus();
    });

    ipcMain.handle('twilio:get-config', async () => {
        console.log('[IPC] Handling twilio:get-config');
        return this.getConfig(); // getConfig already excludes secret
    });

    ipcMain.handle('twilio:get-token', async (event, identity = 'default_user') => {
      console.log(`[IPC] Handling twilio:get-token for identity: ${identity}`);
      const token = await this.generateAccessToken(identity);
      if (token) {
        return { success: true, token: token };
      } else {
        // Provide a more specific error if possible based on the corrected isReadyForToken check
        const errorReason = !this.isReadyForToken()
            ? 'Configuration incomplete (check Account SID, API Key SID, TwiML App SID).' // Corrected message
            : 'Failed to generate access token (check keytar access or token generation logic).'; // Corrected message
        console.error(`[IPC twilio:get-token] Failed: ${errorReason}`); // Log the specific reason
        return { success: false, error: errorReason };
      }
    });

    ipcMain.handle('twilio:list-numbers', async (event, tempCredentials = null) => {
      console.log('[IPC] Handling twilio:list-numbers');
      // Call the method directly, it now returns the expected structure
      return await this.listPhoneNumbers(tempCredentials);
    });

    ipcMain.handle('twilio:save-and-configure', async (event, data) => {
        console.log(`[IPC Received] twilio:save-and-configure (Manager Version: ${TWILIO_MANAGER_CODE_VERSION})`);
        console.log('[IPC Received] twilio:save-and-configure raw data:', JSON.stringify(data));
        const { credentials, selectedNumberSid } = data;

        // 1. Validate incoming data
        console.log(`[Save&Configure] Validating data...`);
        if (!credentials || !credentials.accountSid || !credentials.apiKeySid || !credentials.apiKeySecret || !credentials.functionUrl || !selectedNumberSid) {
            console.error('[Validation Failed] Missing data:', { hasCreds: !!credentials, sid: credentials?.accountSid, key: credentials?.apiKeySid, secret: !!credentials?.apiKeySecret, url: credentials?.functionUrl, numberSid: selectedNumberSid });
            return { success: false, error: 'Incomplete data received for configuration (credentials, function URL, or selected number SID missing).' };
        }
        console.log('[Save&Configure] Data validation passed.');

        try {
            // 2. Securely store the API Key Secret using keytar
            try {
                const { default: keytar } = await import('keytar');
                await keytar.setPassword('ElectronSoftphoneTwilio', credentials.apiKeySid, credentials.apiKeySecret);
                console.log('[Save&Configure] API Key Secret stored in keychain.');
            } catch (keytarError) {
                console.error('[Save&Configure] Error saving API Key Secret to keytar:', keytarError);
                throw new Error(`Failed to securely store API Key Secret: ${keytarError.message}`);
            }

            // 3. Prepare the configuration object to save (excluding the raw secret)
            const configToSave = {
                 accountSid: credentials.accountSid,
                 apiKeySid: credentials.apiKeySid,
                 functionUrl: credentials.functionUrl,
                 audioInputDeviceId: credentials.audioInputDeviceId || 'default',
                 audioOutputDeviceId: credentials.audioOutputDeviceId || 'default',
                 selectedPhoneNumberSid: selectedNumberSid,
                 // twimlAppSid and selectedPhoneNumber will be added later
             };

            // Save the initial part of the config
            this.saveConfig(configToSave); // This now calls initializeClient internally if creds changed
            console.log('[Save&Configure] Initial credentials, URL, audio settings, and selected number SID saved.');

            // Check if client initialized successfully after saveConfig triggered it
            if (!this.twilioClient) {
                 // Attempt re-initialization explicitly just in case saveConfig didn't trigger it correctly
                 console.warn('[Save&Configure] Twilio client not initialized after saveConfig, attempting explicit re-initialization...');
                 await this.initializeClient();
                 if (!this.twilioClient) {
                    throw new Error('Failed to initialize Twilio client after saving credentials.');
                 }
                 console.log('[Save&Configure] Explicit client re-initialization successful.');
            }


            // 4. Fetch the actual phone number string for the selected SID
            let selectedNumberString = '';
            try {
                const numberDetails = await this.twilioClient.incomingPhoneNumbers(selectedNumberSid).fetch();
                selectedNumberString = numberDetails.phoneNumber;
                if (!selectedNumberString) {
                    throw new Error('Fetched number details did not contain a phone number string.');
                }
                this.saveConfig('selectedPhoneNumber', selectedNumberString); // Save fetched number
                console.log(`[Save&Configure] Fetched and saved selected phone number string: ${selectedNumberString}`);
            } catch (fetchError) {
                console.error(`[Save&Configure] Error fetching details for phone number SID ${selectedNumberSid}:`, fetchError);
                throw new Error(`Failed to fetch details for selected phone number: ${fetchError.message}`);
            }

            // 5. Find or Create the TwiML Application
            let twimlAppSid = null;
            try {
                twimlAppSid = await this.findOrCreateTwiMLApp(credentials.functionUrl);
                if (!twimlAppSid) {
                    throw new Error('Failed to find or create the necessary TwiML Application.');
                }
            } catch (apiError) {
                throw new Error(`Failed to find/create TwiML App: ${apiError.message || 'Unknown API error'}`);
            }

            // Store the found/created TwiML App SID
            this.saveConfig('twimlAppSid', twimlAppSid);
            console.log(`[Save&Configure] Using TwiML App SID: ${twimlAppSid}`);

            // 6. Configure the selected phone number to use the TwiML App
            try {
                const configureSuccess = await this.configurePhoneNumber(selectedNumberSid);
                if (!configureSuccess) {
                    throw new Error('Failed to link the selected phone number to the TwiML Application.');
                }
            } catch (apiError) {
                 throw new Error(`Failed to configure phone number: ${apiError.message || 'Unknown API error'}`);
            }

            console.log(`[Save&Configure] Phone number ${selectedNumberString} (${selectedNumberSid}) configured.`);
            console.log('[Save&Configure] Process completed successfully.');

            // Broadcast update to renderer windows
            this.app.broadcastToWindows('twilio-config-updated');
            console.log('[Save&Configure] Broadcasted twilio-config-updated.');

            return { success: true };

        } catch (error) {
             console.error('[Save&Configure] Error:', error);
             return {
                success: false,
                error: (error && typeof error.message === 'string') ? error.message : 'An unknown error occurred during configuration.'
            };
        }
    });

     ipcMain.handle('settings:get-selected-number', async () => {
        console.log('[IPC] Handling settings:get-selected-number');
        const number = this.getSelectedNumberString(); // Use correct method name
        return { success: true, number: number };
    });

    console.log('[TwilioManager] IPC Handlers Bound.');
  }
}

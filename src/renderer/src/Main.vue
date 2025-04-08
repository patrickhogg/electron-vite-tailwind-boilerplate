<template>
  <div class="flex flex-col h-screen bg-gray-800 text-white font-sans">

    <!-- Header: Status & Settings -->
    <header class="flex items-center justify-between p-2 bg-gray-900 shadow-md">
      <span :class="statusColor" class="text-sm font-medium px-2 py-0.5 rounded">
        Status: {{ isConfigured ? registrationStatus : 'Not Configured' }}
      </span>
      <button @click="openSettings" title="Settings" class="text-gray-400 hover:text-white focus:outline-none px-2">
        <font-awesome-icon icon="fa-solid fa-gear" size="lg" />
      </button>
    </header>

    <!-- Main Content Area -->
    <main class="flex-grow flex flex-col items-center justify-center p-4 space-y-4">

      <!-- Configuration Prompt -->
      <div v-if="!isConfigured" class="text-center p-4 bg-yellow-800 rounded-lg shadow-md">
        <p class="text-lg font-semibold mb-2">Configuration Required</p>
        <p class="text-sm mb-3">Please configure your Twilio credentials and select a phone number in the settings.</p>
        <button @click="openSettings" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
          Open Settings
        </button>
      </div>

      <!-- Call Info Display (Input Field) -->
      <div class="w-full max-w-xs text-center bg-gray-700 p-3 rounded-lg shadow">
        <div class="text-xs text-gray-400 mb-1">{{ callStateDisplay }}</div>
        <!-- Replace div with input -->
        <input type="text"
               v-model="enteredNumber"
               @paste="handlePaste"
               @keydown="handleInputKeyDown" 
               :readonly="callState !== 'Idle'" 
               placeholder="Enter number..."
               class="w-full bg-gray-700 text-white text-2xl font-mono text-center h-8 border-none focus:ring-0 p-0 m-0"
        />
      </div>

      <!-- Mic Level Indicator -->
      <div class="w-full max-w-xs px-2">
        <label for="micLevel" class="text-xs text-gray-400">Mic Level:</label>
        <progress id="micLevel" :value="micLevel" max="100" class="w-full h-2 rounded overflow-hidden appearance-none
          [&::-webkit-progress-bar]:bg-gray-600
          [&::-webkit-progress-value]:bg-green-500
          [&::-moz-progress-bar]:bg-green-500"></progress>
      </div>

      <!-- Dial Pad -->
      <div class="grid grid-cols-3 gap-3 w-full max-w-xs">
        <button v-for="key in dialPadKeys" :key="key" @click="handleKeyPress(key)"
                class="p-4 bg-gray-600 rounded-lg text-xl font-semibold hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition duration-150 ease-in-out">
          {{ key }}
        </button>
        <!-- Backspace Button -->
        <button @click="handleBackspace"
                class="p-4 bg-gray-700 rounded-lg text-xl font-semibold hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition duration-150 ease-in-out col-span-1 flex items-center justify-center">
           &larr; <!-- Left Arrow for Backspace -->
        </button>
         <!-- Clear Button -->
        <button @click="clearDisplay"
                class="p-4 bg-gray-700 rounded-lg text-lg font-semibold hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition duration-150 ease-in-out col-span-1 flex items-center justify-center">
           CLR
        </button>
      </div>

      <!-- Call Control Buttons -->
      <div class="flex justify-around w-full max-w-xs pt-4">
        <button @click="handleCallAction" 
                :disabled="!canCallOrAnswer"
                :class="callButtonClass"
                class="p-4 rounded-full text-white text-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 transition duration-150 ease-in-out flex items-center justify-center w-16 h-16">
          <font-awesome-icon icon="fa-solid fa-phone" />
        </button>
        <button @click="handleHangup" :disabled="!canHangup"
                class="p-4 rounded-full text-white text-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 transition duration-150 ease-in-out flex items-center justify-center w-16 h-16"
                :class="canHangup ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-gray-500 cursor-not-allowed'">
           <font-awesome-icon icon="fa-solid fa-phone-slash" />
        </button>
      </div>

       <!-- Audio Element for Remote Stream REMOVED -->

       <!-- Error Display -->
       <div v-if="errorMessage" class="mt-2 text-red-400 text-sm text-center">
         {{ errorMessage }}
       </div>

    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, markRaw, toRaw } from 'vue'; // Import markRaw and toRaw
import { Device } from '@twilio/voice-sdk'; // Corrected Import Twilio Device

// --- Refs ---
const registrationStatus = ref('Not Configured'); // Initial state before checking config
const callState = ref('Idle'); // Idle, Connecting, Ringing, Incoming, Active, Disconnected
const enteredNumber = ref('');
const errorMessage = ref('');
// const remoteAudio = ref(null); // REMOVED: Twilio SDK handles audio output internally

const twilioDevice = ref(null); // Holds the Twilio Device instance
const activeCall = ref(null); // Holds the current active/incoming Twilio Call object

const dialPadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
const isConfigured = ref(false); // Track if the app has necessary config

// --- Listeners ---
// REMOVED old listeners

// --- Refs for Config ---
const currentConfig = ref({ // Store loaded config, including audio devices
    audioInputDeviceId: 'default',
    audioOutputDeviceId: 'default'
});

// --- Refs for Mic Level ---
const micLevel = ref(0); // 0 to 100
let audioContext = null;
let analyserNode = null;
let microphoneSource = null;
let volumeProcessor = null;
let animationFrameId = null;

// --- Computed Properties ---
const statusColor = computed(() => {
  switch (registrationStatus.value) {
    case 'Not Configured': return 'bg-yellow-600 text-black';
    case 'Ready': return 'bg-green-600 text-white'; // Twilio Ready state
    case 'Connecting': return 'bg-yellow-500 text-black'; // Twilio Connecting state
    case 'Offline': return 'bg-gray-500 text-white'; // Twilio Offline state
    case 'Error': return 'bg-red-600 text-white'; // Twilio Error state
    default: return 'bg-gray-500 text-white';
  }
});

// No longer need displayValue, input field v-model handles display

const callStateDisplay = computed(() => {
   // Extract caller ID from activeCall parameters if available
   const caller = activeCall.value?.parameters?.From || activeCall.value?.parameters?.Caller || 'Unknown';
   if (callState.value === 'Incoming') return `Incoming: ${caller}`;
   if (callState.value === 'Ringing') return `Ringing: ${caller}`; // Twilio SDK uses 'ringing' state
   if (callState.value === 'Connecting') return `Calling: ${enteredNumber.value || '...'}`;
   if (callState.value === 'Active') return `Active: ${enteredNumber.value || caller}`;
   return callState.value; // Idle, Disconnected, etc.
});

const canCallOrAnswer = computed(() => {
  if (!isConfigured.value || registrationStatus.value !== 'Ready') return false; // Must be configured and Ready
  if (callState.value === 'Idle' && enteredNumber.value.length > 0) return true; // Can call
  if (callState.value === 'Incoming') return true; // Can answer
  return false;
});

const canHangup = computed(() => {
  // Can hangup if there's an active call object or if the device is trying to connect
  return isConfigured.value && (activeCall.value != null || ['Connecting', 'Ringing', 'Incoming', 'Active'].includes(callState.value));
});

const callButtonClass = computed(() => {
  if (!canCallOrAnswer.value) return 'bg-gray-500 cursor-not-allowed';
  if (callState.value === 'Incoming') return 'bg-green-600 hover:bg-green-700 focus:ring-green-500 animate-pulse'; // Answer button style
  return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'; // Call button style
});


// --- Methods ---

// Filter input to allow only valid dial characters
function sanitizeInput(input) {
  return input.replace(/[^0-9*#]/g, '');
}

// Handle dial pad button clicks
function handleKeyPress(key) {
  // Allow entering numbers only when idle
  if (callState.value === 'Idle') {
      enteredNumber.value += key;
  }
}

function handleBackspace() {
    if (callState.value === 'Idle' && enteredNumber.value.length > 0) {
        enteredNumber.value = enteredNumber.value.slice(0, -1);
    }
}

// Handle paste event into the input field
function handlePaste(event) {
  if (callState.value !== 'Idle') {
    event.preventDefault();
    return;
  }
  const pastedText = (event.clipboardData || window.clipboardData).getData('text');
  const sanitized = sanitizeInput(pastedText);
  // Prevent default paste and update model directly after sanitizing
  event.preventDefault();
  enteredNumber.value = sanitized; 
}

// Handle keyboard input in the input field
function handleInputKeyDown(event) {
   if (callState.value !== 'Idle') {
    event.preventDefault();
    return;
  }
  // Allow navigation keys (arrows, home, end, delete, backspace)
  if ([ 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Delete', 'Backspace', 'Tab' ].includes(event.key)) {
    return; 
  }
  // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X (Cmd on Mac)
  if ((event.ctrlKey || event.metaKey) && ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase())) {
      return;
  }

  // Prevent invalid characters
  if (!/[0-9*#]/.test(event.key)) {
    event.preventDefault();
  }
}

function clearDisplay() {
    if (callState.value === 'Idle') {
        enteredNumber.value = '';
    }
}

// Watch for direct changes to enteredNumber (e.g., from paste) and sanitize
watch(enteredNumber, (newValue) => {
    if (callState.value === 'Idle') {
        const sanitized = sanitizeInput(newValue);
        if (sanitized !== newValue) {
            enteredNumber.value = sanitized;
        }
    }
});

function clearError() {
    errorMessage.value = '';
}

// --- Twilio SDK Initialization ---
async function initializeTwilioDevice() {
    console.log('[Twilio] Attempting to initialize device...');
    // Reset status before attempting initialization
    clearError();
    registrationStatus.value = 'Connecting';

    try {
        // 1. Check if credentials/config are set in main process (using the specific check)
        const credsSet = await window.electronAPI.invoke('twilio:get-credentials-status');
        if (!credsSet) {
            errorMessage.value = 'Twilio not configured. Please check Settings.';
            registrationStatus.value = 'Error';
            console.error('[Twilio] Initialization failed: Credentials not set.');
            return;
        }

        // 2. Get Access Token from Main Process
        console.log('[Twilio] Requesting access token...');
        const identity = 'electron_softphone_user'; // Replace with dynamic identity if needed
        const tokenResult = await window.electronAPI.invoke('twilio:get-token', identity);
        console.log('[Twilio] Token result received:', tokenResult);

        if (!tokenResult || !tokenResult.success || !tokenResult.token) {
            errorMessage.value = tokenResult?.error || 'Failed to get access token.';
            registrationStatus.value = 'Error';
            console.error('[Twilio] Initialization failed: Could not get token. Reason:', tokenResult?.error || 'Unknown');
            return;
        }

        // 3. Initialize Twilio Device
        if (twilioDevice.value) {
            console.log('[Twilio] Destroying existing device instance.');
            twilioDevice.value.destroy();
            twilioDevice.value = null;
        }

        console.log('[Twilio] Creating new Device instance...');
        const deviceInstance = new Device(tokenResult.token, {
            // logLevel: 1, // Revert to default logging
            // edge: 'frankfurt', // Optional: specify edge location
            codecPreferences: ['opus', 'pcmu'], // Optional: prioritize codecs
            // Note: Setting audio devices here might be too early.
            // We set them in the 'registered' listener using applyAudioDeviceSettings
        });

        // Assign the raw device instance to the ref using markRaw
        twilioDevice.value = markRaw(deviceInstance);

        // 4. Setup Event Listeners Directly Here (Attempt 2)
        console.log('[Twilio] Attaching listeners directly after Device creation...');
        twilioDevice.value.on('registered', async () => { // Use 'registered' event
            console.log('[Twilio] >>> Device Registered! Listener Fired (Direct Attach) <<<');
            registrationStatus.value = 'Ready';
            clearError();
            // Pass the device instance to applyAudioDeviceSettings
            await applyAudioDeviceSettings(twilioDevice.value);
        });
        twilioDevice.value.on('unregistered', () => { // Use 'unregistered' event
            console.log('[Twilio] Device Unregistered. (Direct Attach)');
            registrationStatus.value = 'Offline';
        });
        twilioDevice.value.on('error', (error) => {
            console.error('[Twilio] Device Error: (Direct Attach)', error);
            errorMessage.value = `Twilio Error: ${error.message} (Code: ${error.code})`;
            registrationStatus.value = 'Error';
            if (error.code === 31205) {
                console.log('[Twilio] Access token expired or invalid. Re-initializing...');
                initializeTwilioDevice();
            }
        });
        twilioDevice.value.on('incoming', (call) => {
            console.log('[Twilio] Incoming call from: (Direct Attach)', call.parameters.From);
            clearError();
            if (activeCall.value) {
                console.warn('[Twilio] Incoming call while another call is active. Rejecting.');
                call.reject();
                return;
            }
            // Apply markRaw here too for incoming calls
            const rawCall = markRaw(call);
            activeCall.value = rawCall;
            callState.value = 'Incoming';
            setupCallListeners(rawCall); // Pass the raw call object
        });
        console.log('[Twilio] Direct listeners attached.');

        // 5. Register the device
        await twilioDevice.value.register();
        console.log('[Twilio] Device registration initiated.');
        // Status updates handled by listeners ('ready', 'offline', 'error')

    } catch (error) {
        console.error('[Twilio] Initialization error:', error);
        errorMessage.value = `Initialization failed: ${error.message}`;
        registrationStatus.value = 'Error';
        if (twilioDevice.value) {
            twilioDevice.value.destroy();
            twilioDevice.value = null;
        }
    }
}

// REMOVE setupDeviceListeners function as listeners are now attached directly above
/*
function setupDeviceListeners() {
    if (!twilioDevice.value) {
        console.error("[setupDeviceListeners] Attempted to set up listeners, but twilioDevice is null!");
        return;
    }

    console.log('[Twilio] Setting up device listeners...');

    // Remove existing listeners first to prevent duplicates if re-initialized
    twilioDevice.value.removeAllListeners('ready');
    twilioDevice.value.removeAllListeners('offline');
    twilioDevice.value.removeAllListeners('error');
    twilioDevice.value.removeAllListeners('incoming');

    twilioDevice.value.on('ready', async (device) => {
        console.log('[Twilio] >>> Device Ready! Listener Fired <<<'); // Enhanced log
        registrationStatus.value = 'Ready';
        clearError();
        // Apply audio device settings now that device is ready
        await applyAudioDeviceSettings(device);
    });

    twilioDevice.value.on('offline', (device) => {
        console.log('[Twilio] Device Offline.');
        registrationStatus.value = 'Offline';
        // Potentially attempt re-initialization after a delay?
    });

    twilioDevice.value.on('error', (error) => {
        console.error('[Twilio] Device Error:', error);
        errorMessage.value = `Twilio Error: ${error.message} (Code: ${error.code})`;
        registrationStatus.value = 'Error';
        // Handle specific error codes if needed
        // e.g., 31205: Token expired -> re-fetch token
        if (error.code === 31205) {
            console.log('[Twilio] Access token expired or invalid. Re-initializing...');
            initializeTwilioDevice(); // Attempt to get a new token
        }
    });

    twilioDevice.value.on('incoming', (call) => {
        console.log('[Twilio] Incoming call from:', call.parameters.From);
        clearError();
        if (activeCall.value) {
            console.warn('[Twilio] Incoming call while another call is active. Rejecting.');
            call.reject();
            return;
        }
        activeCall.value = call;
        callState.value = 'Incoming';
        setupCallListeners(call);
    });
     console.log('[Twilio] Device listeners set up.');
}
*/

function setupCallListeners(call) {
     if (!call) return;
     console.log(`[Twilio] Setting up listeners for call SID: ${call.sid}`);

     call.on('accept', (acceptedCall) => {
        console.log('[Twilio Call] Call accepted.');
        // activeCall.value should already be set
        callState.value = 'Connecting'; // Or 'Active' depending on exact flow
     });

     call.on('connect', (connectedCall) => {
         console.log('[Twilio Call] Call connected.');
         callState.value = 'Active';
         // enteredNumber might be cleared here if desired for incoming calls
     });

     call.on('disconnect', (disconnectedCall) => {
        console.log('[Twilio Call] Call disconnected.');
        // Compare the raw version of activeCall with the disconnectedCall
        const rawActiveCall = activeCall.value ? toRaw(activeCall.value) : null;

        // Reset state immediately
        if (rawActiveCall && rawActiveCall === disconnectedCall) {
            console.log('[Twilio Call] Disconnect matches active call. Resetting state.');
            activeCall.value = null;
            callState.value = 'Idle';
            enteredNumber.value = ''; // Clear number display
        } else {
            // If the disconnected call doesn't match the current active one (e.g., stale event),
            // or if activeCall was already null, just ensure state is Idle if nothing is active.
            console.log('[Twilio Call] Disconnect did not match active call or active call was null.');
            if (!activeCall.value) {
                callState.value = 'Idle';
                enteredNumber.value = '';
            }
        }
        // Remove the setTimeout for immediate state update
     });

     call.on('cancel', (cancelledCall) => {
        console.log('[Twilio Call] Call cancelled (by caller).');
        callState.value = 'Disconnected'; // Treat as disconnected
        const rawActiveCall = activeCall.value ? toRaw(activeCall.value) : null;
        // Reset state immediately
        if (rawActiveCall && rawActiveCall === cancelledCall) {
            console.log('[Twilio Call] Cancel matches active call. Resetting state.');
            activeCall.value = null;
            callState.value = 'Idle';
            enteredNumber.value = '';
        } else {
            console.log('[Twilio Call] Cancel did not match active call or active call was null.');
             if (!activeCall.value) {
                 callState.value = 'Idle';
                 enteredNumber.value = '';
             }
        }
     });

     call.on('reject', (rejectedCall) => {
        console.log('[Twilio Call] Call rejected (by us).');
        callState.value = 'Disconnected'; // Treat as disconnected
        const rawActiveCall = activeCall.value ? toRaw(activeCall.value) : null;
         // Reset state immediately
        if (rawActiveCall && rawActiveCall === rejectedCall) {
            console.log('[Twilio Call] Reject matches active call. Resetting state.');
            activeCall.value = null;
            callState.value = 'Idle';
            enteredNumber.value = '';
        } else {
            console.log('[Twilio Call] Reject did not match active call or active call was null.');
             if (!activeCall.value) {
                 callState.value = 'Idle';
                 enteredNumber.value = '';
             }
        }
     });

     call.on('error', (error, errorCall) => {
         console.error('[Twilio Call] Call Error:', error);
         errorMessage.value = `Call Error: ${error.message}`;
         callState.value = 'Disconnected'; // Treat as disconnected on error
        const rawActiveCall = activeCall.value ? toRaw(activeCall.value) : null;
         // Reset state immediately
        if (rawActiveCall && rawActiveCall === errorCall) {
            console.log('[Twilio Call] Error matches active call. Resetting state.');
            activeCall.value = null;
            callState.value = 'Idle';
            enteredNumber.value = '';
        } else {
            console.log('[Twilio Call] Error did not match active call or active call was null.');
             if (!activeCall.value) {
                 callState.value = 'Idle';
                 enteredNumber.value = '';
             }
        }
     });

     // Add other listeners like 'ringing', 'warning', 'reconnecting' if needed
     call.on('ringing', (hasEarlyMedia) => {
         console.log(`[Twilio Call] Ringing (Early Media: ${hasEarlyMedia})`);
         callState.value = 'Ringing';
     });

     console.log(`[Twilio] Call listeners set up for SID: ${call.sid}`);
}

// --- Call Actions ---

async function makeCall() {
    clearError();
    if (registrationStatus.value !== 'Ready' || !enteredNumber.value || !twilioDevice.value) {
        errorMessage.value = 'Device not ready or no number entered.';
        return;
    }

    console.log(`[Twilio] Attempting to call: ${enteredNumber.value}`);
    callState.value = 'Connecting';

    try {
        // Get the selected caller ID from settings
        const numResult = await window.electronAPI.invoke('settings:get-selected-number'); // Use the correct IPC channel name
        const callerId = numResult?.success ? numResult.number : null;
        console.log(`[makeCall] Using Caller ID: ${callerId}`); // Log caller ID

        if (!callerId) {
            throw new Error('Caller ID not configured in settings.');
        }

        const params = {
            To: enteredNumber.value,
            CallerId: callerId // Pass selected number as CallerId
        };
        console.log('[Twilio] Making call with params:', params);

        // Start the call
        console.log('[makeCall] Calling twilioDevice.connect...');
        const call = await twilioDevice.value.connect({ params: params });
        console.log('[makeCall] twilioDevice.connect returned. Call object:', call);
        // Apply markRaw to the call object as well
        const rawCall = markRaw(call);
        activeCall.value = rawCall;
        setupCallListeners(rawCall); // Pass the raw call object to setup listeners
        // State will update via listeners ('ringing', 'connect', 'disconnect')

    } catch (error) {
        console.error('[Twilio] Make call error:', error);
        errorMessage.value = `Call failed: ${error.message}`;
        callState.value = 'Idle'; // Reset state on failure
        activeCall.value = null;
    }
}

function answerCall() {
    console.log('[answerCall] Function called.');
    clearError();
    // Get the raw object using toRaw before calling methods on it
    const rawCall = activeCall.value ? toRaw(activeCall.value) : null;
    console.log('[answerCall] rawCall:', rawCall);

    if (!rawCall || callState.value !== 'Incoming') {
        errorMessage.value = 'No incoming call to answer.';
        console.warn('[answerCall] Condition not met:', { hasActiveCall: !!rawCall, state: callState.value });
        return;
    }
    console.log('[Twilio] Answering call...');
    try {
        rawCall.accept(); // Call accept on the raw object
        console.log('[answerCall] rawCall.accept() called successfully.');
    } catch (error) {
        console.error('[answerCall] Error calling rawCall.accept():', error);
        errorMessage.value = `Failed to accept call: ${error.message}`;
    }
    // State updates handled by 'accept' and 'connect' listeners
}

function handleCallAction() {
  console.log('[handleCallAction] Clicked! Current state:', callState.value);
  clearError();
  // Add extra check for activeCall just in case
  if (!canCallOrAnswer.value) {
      console.warn('[handleCallAction] Cannot call or answer. State:', { isConfigured: isConfigured.value, registrationStatus: registrationStatus.value, callState: callState.value });
      return;
  }

  if (callState.value === 'Idle') {
    makeCall();
  } else if (callState.value === 'Incoming') {
    answerCall();
  }
}

function handleHangup() {
  clearError();
  console.log('[Twilio] Hangup requested.');
  const rawCallToDisconnect = activeCall.value ? toRaw(activeCall.value) : null;
  const rawDevice = twilioDevice.value ? toRaw(twilioDevice.value) : null;

  if (rawCallToDisconnect && callState.value === 'Incoming') {
      // Reject incoming call
      console.log(`[Twilio] Rejecting incoming call SID: ${rawCallToDisconnect.sid}`);
      rawCallToDisconnect.reject(); // Call reject on the raw object
      // Manually reset state here as the 'reject' listener might not fire reliably
      // when initiated locally.
      activeCall.value = null;
      callState.value = 'Idle';
      enteredNumber.value = '';
      console.log('[handleHangup] State reset after calling reject().');
  } else if (rawCallToDisconnect) {
      // Disconnect active/connecting call
      console.log(`[Twilio] Disconnecting active call SID: ${rawCallToDisconnect.sid}`);
      rawCallToDisconnect.disconnect(); // Call disconnect on the raw object
      // activeCall ref will be cleared in the disconnect listener
  } else if (rawDevice && callState.value === 'Connecting') {
      // Handle case where user hangs up an outgoing call before it fully connects
      console.log('[Twilio] Disconnecting all calls (likely cancelling outgoing).');
      rawDevice.disconnectAll(); // Call disconnectAll on the raw object
  } else {
      console.warn('[Twilio] No active call to hangup.');
      // Force back to idle if somehow stuck
      if (callState.value !== 'Idle') {
          callState.value = 'Idle';
          enteredNumber.value = '';
      }
  }
}

function openSettings() {
  clearError();
  console.log('Requesting to open settings window...');
  window.electronAPI.send('ui:open-settings-window');
}


// --- Audio Device Management ---

async function loadAudioConfig() {
    console.log('[Audio] Loading audio device configuration...');
    try {
        const configResult = await window.electronAPI.invoke('twilio:get-config');
        if (configResult) {
            currentConfig.value.audioInputDeviceId = configResult.audioInputDeviceId || 'default';
            currentConfig.value.audioOutputDeviceId = configResult.audioOutputDeviceId || 'default';
            console.log('[Audio] Loaded audio device IDs:', currentConfig.value.audioInputDeviceId, currentConfig.value.audioOutputDeviceId);
        } else {
             console.warn('[Audio] Failed to load audio config from main process.');
        }
    } catch (error) {
        console.error('[Audio] Error loading audio config:', error);
        errorMessage.value = 'Error loading audio settings.';
    }
}

async function applyAudioDeviceSettings(deviceInstance) {
    const device = deviceInstance || twilioDevice.value; // Use passed instance or the ref
    if (!device || !device.audio) {
        console.warn('[Audio] Cannot apply settings: Twilio device or audio helper not ready.');
        return;
    }

    const inputDeviceId = currentConfig.value.audioInputDeviceId;
    const outputDeviceId = currentConfig.value.audioOutputDeviceId;

    console.log(`[Audio] Applying Input: ${inputDeviceId}, Output: ${outputDeviceId}`);

    try {
        console.log(`[applyAudioDeviceSettings] Applying Output: ${outputDeviceId}`);
        if (device.audio.isOutputSelectionSupported && outputDeviceId) {
            // Only set speaker if NOT default
            if (outputDeviceId !== 'default') {
                const devicesToSet = [outputDeviceId];
                console.log(`[applyAudioDeviceSettings] Calling speakerDevices.set with:`, devicesToSet);
                await device.audio.speakerDevices.set(devicesToSet);
                console.log('[Audio] Speaker device set successfully.');
            } else {
                console.log('[applyAudioDeviceSettings] Output device is default, skipping speakerDevices.set()');
                // Explicitly do nothing, let the browser/SDK handle default
            }
        } else if (!device.audio.isOutputSelectionSupported) {
             console.warn('[Audio] Speaker device selection not supported by this environment.');
        }

        console.log(`[applyAudioDeviceSettings] Applying Input: ${inputDeviceId}`);
        if (device.audio.isInputSelectionSupported && inputDeviceId) {
            const deviceToSet = inputDeviceId === 'default' ? '' : inputDeviceId;
            console.log(`[applyAudioDeviceSettings] Calling setInputDevice with:`, deviceToSet || '(empty string for default)');
            await device.audio.setInputDevice(deviceToSet);
             console.log('[Audio] Input device set successfully.');
        } else if (!device.audio.isInputSelectionSupported) {
             console.warn('[Audio] Input device selection not supported by this environment.');
        }

        // Restart mic analysis with potentially new input device
        await startMicAnalysis();

    } catch (error) {
        console.error('[Audio] Error applying audio device settings:', error);
        errorMessage.value = `Audio device error: ${error.message}`;
    }
}


// --- Lifecycle Hooks ---
let configUpdateListenerRemover = null; // Store the remover function

async function performInitialSetup() {
    console.log('[performInitialSetup] Starting...'); // <-- Log start
    // 1. Check configuration status
    try {
        isConfigured.value = await window.electronAPI.invoke('twilio:get-credentials-status');
        console.log(`[performInitialSetup] Checked config status: ${isConfigured.value}`); // <-- Log status check result
    } catch (error) {
        console.error('[performInitialSetup] Error checking config status:', error);
        isConfigured.value = false; // Assume not configured on error
        registrationStatus.value = 'Error';
        errorMessage.value = 'Error checking configuration status.';
        return; // Stop setup if status check fails
    }

    if (isConfigured.value) {
        console.log('[performInitialSetup] App is configured. Proceeding with setup...'); // <-- Log configured path
        registrationStatus.value = 'Offline'; // Set initial status before connecting
        // 2. Load audio config
        await loadAudioConfig();
        // 3. Initialize Twilio Device (fetches token, registers)
        await initializeTwilioDevice();
        // 4. Start microphone analysis
        await startMicAnalysis();
    } else {
        registrationStatus.value = 'Not Configured';
        errorMessage.value = 'Please configure Twilio in Settings.';
        // Stop mic analysis if it was somehow running
        stopMicAnalysis();
        console.log('[performInitialSetup] App is NOT configured. Setup stopped.'); // <-- Log not configured path
    }
    console.log('[performInitialSetup] Completed.'); // <-- Log end
}

onMounted(async () => {
  if (!window.electronAPI) {
    console.error("FATAL: electronAPI not found on window. Preload script likely failed.");
    registrationStatus.value = 'Error'; // Keep this specific error state
    errorMessage.value = 'Initialization Error.';
    return;
  }

  // Perform the initial setup checks and initialization
  await performInitialSetup();

  // *** Listen for config updates from main process ***
  if (window.electronAPI && typeof window.electronAPI.on === 'function') {
      configUpdateListenerRemover = window.electronAPI.on('twilio-config-updated', () => {
          console.log('[Main.vue IPC Received] === twilio-config-updated ==='); // <-- Log listener trigger
          // Re-run the full setup check
          // Use a timeout to ensure settings window might have closed and main process settled
          setTimeout(async () => {
              console.log('[Main.vue IPC Received] Running performInitialSetup() after delay...'); // <-- Log before setup call
              await performInitialSetup();
              console.log('[Main.vue IPC Received] performInitialSetup() completed.'); // <-- Log after setup call
          }, 100); // Small delay
      });
      console.log('[Main.vue] Set up listener for twilio-config-updated.');
  } else {
       console.error('[Main.vue] Failed to set up listener for twilio-config-updated: electronAPI.on not available.');
  }

});

onUnmounted(() => {
  // Destroy the Twilio Device connection
  if (twilioDevice.value) {
    console.log('[Twilio] Destroying Twilio Device instance.');
    twilioDevice.value.destroy();
    twilioDevice.value = null;
  }
  activeCall.value = null; // Clear active call reference

  // Stop microphone analysis
  stopMicAnalysis();

  // *** Clean up the config update listener ***
  if (configUpdateListenerRemover) {
      configUpdateListenerRemover();
      console.log('[Main.vue] Removed listener for twilio-config-updated.');
  }

  // Clean up any other listeners if added
});

// --- Audio Input (Microphone Level) Helpers ---

async function startMicAnalysis() {
  // Ensure audio config is loaded before starting
  if (!currentConfig.value.audioInputDeviceId) {
      console.warn('[Mic Analysis] Cannot start, audio input device ID not loaded.');
      // Attempt to load it again?
      await loadAudioConfig();
      if (!currentConfig.value.audioInputDeviceId) return; // Still not loaded, abort
  }

  console.log('[Mic Analysis] Starting...');
  stopMicAnalysis(); // Stop previous instance if any

  try {
    const deviceId = currentConfig.value.audioInputDeviceId;
    const constraints = {
      // Use exact deviceId if specified and not 'default'
      audio: deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : true,
      video: false
    };
    console.log('Mic constraints:', constraints);

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256; // Smaller FFT size for faster analysis
    microphoneSource = audioContext.createMediaStreamSource(stream);

    // Connect source to analyser
    microphoneSource.connect(analyserNode);

    // We don't connect to destination, just analysing

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function updateLevel() {
      analyserNode.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      let average = sum / bufferLength;
      // Scale average (0-255) to a 0-100 level
      // This scaling might need adjustment based on typical levels
      micLevel.value = Math.min(100, Math.max(0, (average / 128) * 100));

      animationFrameId = requestAnimationFrame(updateLevel);
    }

    updateLevel(); // Start the loop

    // Store the stream to stop its tracks later
    volumeProcessor = stream;

    console.log('Microphone analysis started.');

  } catch (err) {
    console.error('Error starting microphone analysis:', err);
    errorMessage.value = `Mic Error: ${err.name}`;
    stopMicAnalysis(); // Clean up on error
  }
}

function stopMicAnalysis() {
  console.log('Stopping microphone analysis...');
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (volumeProcessor) {
    volumeProcessor.getTracks().forEach(track => track.stop());
    volumeProcessor = null;
  }
  if (microphoneSource) {
    microphoneSource.disconnect();
    microphoneSource = null;
  }
  if (analyserNode) {
    analyserNode.disconnect(); // Should be disconnected already, but just in case
    analyserNode = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close();
    audioContext = null;
  }
  micLevel.value = 0; // Reset level
  console.log('Microphone analysis stopped.');
}

// --- Audio Output Helper ---
// --- Audio Output Helper --- REMOVED (Handled by applyAudioDeviceSettings using SDK)

</script>

<style>
/* Add transition for status color */
.rounded {
  transition: background-color 0.3s ease-in-out;
}
/* Basic pulse for incoming call button */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
.animate-pulse {
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>

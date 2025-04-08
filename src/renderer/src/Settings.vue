<template>
  <div class="p-4 space-y-4">
    <h1 class="text-xl font-semibold">Twilio Voice Settings</h1>

    <form @submit.prevent="saveAndConfigure" class="space-y-3">
      <!-- Twilio Credentials -->
      <fieldset class="border border-gray-600 p-3 rounded">
        <legend class="text-sm font-medium text-gray-400 px-1">Twilio Credentials</legend>
        <div class="space-y-2">
          <div>
            <label for="twilio-account-sid" class="block text-sm font-medium text-gray-700">Account SID</label>
            <input type="text" id="twilio-account-sid" v-model="config.accountSid" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">
          </div>
          <div>
            <label for="twilio-api-key-sid" class="block text-sm font-medium text-gray-700">API Key SID</label>
            <input type="text" id="twilio-api-key-sid" v-model="config.apiKeySid" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900" placeholder="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">
          </div>
          <div>
            <label for="twilio-api-key-secret" class="block text-sm font-medium text-gray-700">API Key Secret</label>
            <input type="password" id="twilio-api-key-secret" v-model="config.apiKeySecret" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900" placeholder="••••••••••••••••••••••••••••••••">
          </div>
          <!-- Added Twilio Function URL Field -->
          <div>
            <label for="twilio-function-url" class="block text-sm font-medium text-gray-700">Twilio Function URL</label>
            <input type="url" id="twilio-function-url" v-model="config.functionUrl" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900" placeholder="https://your-service-XXXX.twil.io/call-handler">
             <p class="mt-1 text-xs text-gray-500">URL of the Twilio Function handling calls. <a href="#" @click.prevent="showFunctionHelp" class="text-indigo-600 hover:underline">(?)</a></p>
          </div>
        </div>
      </fieldset>

      <!-- Phone Number Selection -->
       <fieldset class="border border-gray-600 p-3 rounded" :disabled="!credentialsValid">
         <legend class="text-sm font-medium text-gray-400 px-1">Phone Number</legend>
         <div class="space-y-2">
            <!-- Removed Load Numbers Button - Now triggered by credential changes -->
            <!-- <button type="button" @click="checkCredentialsAndLoadNumbers" :disabled="loadingNumbers || !config.accountSid || !config.apiKeySid || !config.apiKeySecret" class="mb-2 inline-flex justify-center rounded-md border border-transparent bg-blue-500 py-1 px-3 text-sm font-medium text-white shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {{ loadingNumbers ? 'Loading...' : 'Load Numbers' }}
            </button> -->
            <div>
                <label for="twilio-phone-number" class="block text-sm font-medium text-gray-700">Select Number</label>
                <select id="twilio-phone-number" v-model="selectedPhoneNumberSid" @change="onNumberSelected" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900" :disabled="loadingNumbers || availableNumbers.length === 0">
                <option disabled value="">{{ loadingNumbers ? 'Loading...' : (availableNumbers.length === 0 ? (credentialsValid ? 'No numbers found' : 'Enter valid credentials & URL') : 'Select a number') }}</option>
                <option v-for="num in availableNumbers" :key="num.sid" :value="num.sid">
                    {{ num.phoneNumber }}
                </option>
                </select>
                <p v-if="!credentialsValid && config.accountSid && config.apiKeySid && config.apiKeySecret && config.functionUrl" class="mt-1 text-xs text-red-600">Could not load numbers. Check credentials & URL.</p>
                <p v-else-if="!credentialsValid" class="mt-1 text-xs text-yellow-600">Enter valid credentials & Function URL above to load numbers.</p>
            </div>
         </div>
       </fieldset>

      <!-- Audio Device Selection -->
      <fieldset class="border border-gray-600 p-3 rounded">
        <legend class="text-sm font-medium text-gray-400 px-1">Audio Devices</legend>
        <div class="space-y-2">

      <!-- Audio Input Select -->
      <div>
        <label for="audio-input" class="block text-sm font-medium text-gray-700">Audio Input (Microphone)</label>
        <select id="audio-input" v-model="config.audioInputDeviceId" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900">
          <option value="default">Default</option>
          <option v-for="device in audioInputDevices" :key="device.deviceId" :value="device.deviceId">
            {{ device.label || `Microphone ${audioInputDevices.indexOf(device) + 1}` }}
          </option>
        </select>
      </div>

      <!-- Audio Output Select -->
      <div>
        <label for="audio-output" class="block text-sm font-medium text-gray-700">Audio Output (Speaker)</label>
        <select id="audio-output" v-model="config.audioOutputDeviceId" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900">
           <option value="default">Default</option>
           <option v-for="device in audioOutputDevices" :key="device.deviceId" :value="device.deviceId">
            {{ device.label || `Speaker ${audioOutputDevices.indexOf(device) + 1}` }}
          </option>
        </select>
      </div>

        </div>
      </fieldset>

      <hr class="my-4 border-gray-600">

      <!-- Action Buttons -->
      <div class="flex justify-end space-x-2 pt-4">
         <span class="text-sm text-gray-600 mr-auto" :class="{ 'text-red-600': statusMessage.startsWith('Error'), 'text-green-600': statusMessage.startsWith('Config') }">Status: {{ statusMessage }}</span>
         <button type="button" @click="closeWindow" class="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">Cancel</button>
         <button type="submit" :disabled="!canSave" class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {{ saveButtonText }}
         </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';

// --- Refs ---
const config = ref({
  accountSid: '',
  apiKeySid: '',
  apiKeySecret: '',
  functionUrl: '', // Added Function URL field
  // Internal state, not directly edited by user but saved
  twimlAppSid: '', // This will be populated automatically by the main process
  selectedPhoneNumber: '', // Store the selected number string
  selectedPhoneNumberSid: '', // Store the selected number SID
  // Audio devices remain
  audioInputDeviceId: 'default',
  audioOutputDeviceId: 'default'
});

const availableNumbers = ref([]); // Array of { phoneNumber: string, sid: string }
const selectedPhoneNumberSid = ref(''); // Store the SID of the selected number

const audioInputDevices = ref([]);
const audioOutputDevices = ref([]);

const statusMessage = ref('Loading...');
const loadingNumbers = ref(false);
const credentialsValid = ref(false); // Track if entered credentials seem valid enough to fetch numbers
const saveInProgress = ref(false);

// --- Computed Properties ---
const canSave = computed(() => {
    // Basic check: ensure credential fields, function URL, and a phone number SID are present
    return config.value.accountSid &&
           config.value.apiKeySid &&
           config.value.apiKeySecret &&
           config.value.functionUrl && // Check for functionUrl instead of twimlAppSid
           selectedPhoneNumberSid.value && // Ensure a number SID is selected
           !saveInProgress.value;
});

const saveButtonText = computed(() => {
    return saveInProgress.value ? 'Saving...' : 'Save & Configure';
});

// --- Watchers ---
// Watch credentials AND function URL to re-validate and fetch numbers when they change
watch(() => [config.value.accountSid, config.value.apiKeySid, config.value.apiKeySecret, config.value.functionUrl], async (newValues) => {
    // Only re-validate if all required fields seem populated
    if (newValues.every(v => v && v.trim() !== '')) {
        await checkCredentialsAndLoadNumbers();
    } else {
        credentialsValid.value = false;
        availableNumbers.value = []; // Clear numbers if creds are incomplete
        selectedPhoneNumberSid.value = ''; // Reset selection
        statusMessage.value = 'Enter credentials & Function URL.'; // Update status
    }
}, { deep: true });


// --- Methods ---

// Function to get audio devices (remains mostly the same)
async function getAudioDevices() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true }); // Request permission
    const devices = await navigator.mediaDevices.enumerateDevices();
    audioInputDevices.value = devices.filter(device => device.kind === 'audioinput');
    audioOutputDevices.value = devices.filter(device => device.kind === 'audiooutput');
    console.log('Audio Input Devices:', audioInputDevices.value);
    console.log('Audio Output Devices:', audioOutputDevices.value);

    // Ensure selected device still exists, otherwise reset to default
    if (!audioInputDevices.value.some(d => d.deviceId === config.value.audioInputDeviceId)) {
      config.value.audioInputDeviceId = 'default';
    }
    if (!audioOutputDevices.value.some(d => d.deviceId === config.value.audioOutputDeviceId)) {
      config.value.audioOutputDeviceId = 'default';
    }
  } catch (err) {
    console.error('Error enumerating audio devices:', err);
    statusMessage.value = 'Error getting audio devices.';
  }
}

// Load existing configuration from main process
async function loadSettings() {
  statusMessage.value = 'Loading config...';
  try {
    const result = await window.electronAPI.invoke('twilio:get-config');
    if (result) {
      // Only update fields present in the result to avoid overwriting defaults unnecessarily
      for (const key in result) {
          if (key in config.value) {
              config.value[key] = result[key];
          }
      }
      // Restore selected phone number SID if it exists in loaded config
      if (result.selectedPhoneNumberSid) {
          selectedPhoneNumberSid.value = result.selectedPhoneNumberSid;
      }
      console.log('Loaded config:', config.value);
      statusMessage.value = 'Config loaded.';
      // Check credentials and load numbers after loading config
      await checkCredentialsAndLoadNumbers(); // This will trigger if loaded creds are valid
    } else {
        statusMessage.value = 'Failed to load config.';
        credentialsValid.value = false;
    }
  } catch (error) {
    console.error("Error loading settings:", error);
    statusMessage.value = 'Error loading config.';
    credentialsValid.value = false;
  }
}

// Check if credentials and function URL seem valid and load numbers if they are
async function checkCredentialsAndLoadNumbers() {
    // Check for functionUrl as well
    if (!config.value.accountSid || !config.value.apiKeySid || !config.value.apiKeySecret || !config.value.functionUrl) {
        credentialsValid.value = false;
        availableNumbers.value = [];
        selectedPhoneNumberSid.value = ''; // Reset selection
        statusMessage.value = 'Enter Twilio credentials.';
        return;
    }

    // Assume credentials *might* be valid, try fetching numbers
    statusMessage.value = 'Checking credentials & loading numbers...';
    loadingNumbers.value = true;
    availableNumbers.value = []; // Clear previous list
    // Pass credentials directly to list-numbers for temporary use
    const credsToCheck = {
        accountSid: config.value.accountSid,
        apiKeySid: config.value.apiKeySid,
        apiKeySecret: config.value.apiKeySecret,
        // functionUrl is not needed for listing numbers, but send it if needed by main process logic
        // functionUrl: config.value.functionUrl
    };

    try {
        // Use the 'twilio:list-numbers' IPC handler, passing temporary credentials
        const result = await window.electronAPI.invoke('twilio:list-numbers', credsToCheck);
        if (result && result.success) {
            credentialsValid.value = true; // If API call succeeded, creds are likely valid
            availableNumbers.value = result.numbers || [];
            statusMessage.value = availableNumbers.value.length > 0 ? 'Select a phone number.' : 'Credentials OK, but no numbers found.';
            // Ensure the previously selected SID still exists in the new list
            if (!availableNumbers.value.some(n => n.sid === selectedPhoneNumberSid.value)) {
                selectedPhoneNumberSid.value = ''; // Reset if previous selection is gone
            }
        } else {
            credentialsValid.value = false;
            statusMessage.value = `Error: ${result?.error || 'Failed to load numbers. Check credentials & URL.'}`;
            selectedPhoneNumberSid.value = '';
        }
    } catch (error) {
        console.error("Error listing numbers:", error);
        credentialsValid.value = false;
        statusMessage.value = `Error: ${error.message || 'Failed loading numbers.'}`;
        selectedPhoneNumberSid.value = '';
    } finally {
        loadingNumbers.value = false;
    }
}


// Save credentials, selected number details, and configure the number on Twilio
async function saveAndConfigure() {
  if (!canSave.value) return;

  saveInProgress.value = true;
  statusMessage.value = 'Saving credentials...';

  try {
    // 1. Prepare the credentials object to send to the main process
    // Exclude the secret, as it will be handled by keytar in the main process
    const plainCredentials = {
        accountSid: config.value.accountSid,
        apiKeySid: config.value.apiKeySid,
        apiKeySecret: config.value.apiKeySecret, // Send secret for initial save to keytar
        functionUrl: config.value.functionUrl,
        // Include audio settings as they are part of the config saved
        audioInputDeviceId: config.value.audioInputDeviceId,
        audioOutputDeviceId: config.value.audioOutputDeviceId,
        // twimlAppSid, selectedPhoneNumber are handled by main process
    };

    // 2. Get Selected Number Details (needed by main process, though it could re-fetch)
    // This is removed as main process now fetches the number string itself using the SID
    /*
    const selectedNumberDetails = availableNumbers.value.find(n => n.sid === selectedPhoneNumberSid.value);
    if (!selectedNumberDetails) {
        throw new Error('Selected number details not found.');
    }
    // Ensure selectedNumberDetails is plain (it should be from find)
    const plainSelectedNumberDetails = { ...selectedNumberDetails };
    */

    // *** ADDING DETAILED LOGGING BEFORE INVOKE ***
    const dataToSend = {
        credentials: plainCredentials,
        selectedNumberSid: selectedPhoneNumberSid.value
    };
    console.log('--- Sending to twilio:save-and-configure ---');
    console.log('Credentials Payload:', JSON.stringify(dataToSend.credentials));
    console.log('Selected Number SID:', dataToSend.selectedNumberSid);
    console.log('---------------------------------------------');

    // Validate selectedPhoneNumberSid explicitly before sending
    if (!dataToSend.selectedNumberSid) {
        throw new Error('Validation Error: Selected Phone Number SID is missing before sending to main process.');
    }

    statusMessage.value = 'Configuring on Twilio...'; // Update status


    // 3. Call the main process handler to save, configure TwiML App, and link number
    const configureResult = await window.electronAPI.invoke('twilio:save-and-configure', dataToSend);

    if (!configureResult || !configureResult.success) {
      throw new Error(configureResult?.error || 'Failed to save configuration and link number on Twilio.');
    }

    statusMessage.value = 'Configuration successful!';
    // Optionally close window after success
    // setTimeout(closeWindow, 1500);

  } catch (receivedError) {
    console.error("Raw error received during save/configure:", receivedError);
    if (receivedError instanceof Error) {
        statusMessage.value = `Error: ${receivedError.message}`;
    } else if (typeof receivedError === 'string') {
         statusMessage.value = `Error: ${receivedError}`;
    } else {
        statusMessage.value = 'Error: Configuration failed (unknown error type).';
        console.error("Non-standard error object received:", JSON.stringify(receivedError));
    }
  } finally {
      saveInProgress.value = false;
  }
}

// Called when the number selection changes in the dropdown
function onNumberSelected() {
    // No immediate action needed here, the SID is bound with v-model
    // We save/configure only when the main button is clicked.
    console.log("Selected Phone Number SID:", selectedPhoneNumberSid.value);
}

// Show help/info about the Twilio Function
function showFunctionHelp() {
    // In a real app, this could open a modal or link to documentation
    alert(`You need to create a simple Twilio Function with the following code and paste its URL here:

` +
          `exports.handler = function(context, event, callback) {
` +
          `  const VoiceResponse = Twilio.twiml.VoiceResponse;
` +
          `  const response = new VoiceResponse();
` +
          `  const dial = response.dial({ callerId: event.From }); // Use original caller ID
` +
          `  dial.client({}, 'electron_softphone_user'); // Route to your client identity
` +
          `  callback(null, response);
` +
          `};`);
}

function closeWindow() {
  // Ask the main process to close this specific window
  window.electronAPI.send('close-settings'); // Use the controller ID (assuming it remains 'settings')
}

// --- Lifecycle Hooks ---

onMounted(() => {
  loadSettings(); // Load Twilio config, which triggers number loading if creds are valid
  getAudioDevices(); // Load audio devices

  // Listen for device changes (optional but good practice)
  navigator.mediaDevices.addEventListener('devicechange', getAudioDevices);

  // No Twilio status listener needed here, status is managed in Main.vue
});

onUnmounted(() => {
  // Remove device change listener
  navigator.mediaDevices.removeEventListener('devicechange', getAudioDevices);
});

</script>

<style>
/* Include base styles if needed, or rely on global import */
/* @import '../assets/base.css'; */

/* Add styles for disabled fieldsets */
fieldset:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
fieldset:disabled select,
fieldset:disabled input {
    background-color: #e9ecef; /* Lighter gray for disabled inputs */
}
</style>

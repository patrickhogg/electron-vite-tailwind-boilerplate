<template>
  <div class="p-4 space-y-4">
    <h1 class="text-xl font-semibold">SIP Settings</h1>

    <form @submit.prevent="saveSettings" class="space-y-3">
      <div>
        <label for="sip-server" class="block text-sm font-medium text-gray-700">SIP Server</label>
        <input type="text" id="sip-server" v-model="config.server" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900" placeholder="sip.example.com">
      </div>

      <div>
        <label for="sip-port" class="block text-sm font-medium text-gray-700">Port</label>
        <input type="number" id="sip-port" v-model.number="config.port" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900" placeholder="5060">
      </div>

      <div>
        <label for="sip-username" class="block text-sm font-medium text-gray-700">Username</label>
        <input type="text" id="sip-username" v-model="config.username" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900" placeholder="1001">
      </div>

      <div>
        <label for="sip-password" class="block text-sm font-medium text-gray-700">Password</label>
        <input type="password" id="sip-password" v-model="config.password" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900">
      </div>

       <div>
        <label for="sip-displayname" class="block text-sm font-medium text-gray-700">Display Name</label>
        <input type="text" id="sip-displayname" v-model="config.displayName" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900" placeholder="Your Name">
      </div>

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

      <hr class="my-4 border-gray-600">

      <div class="flex justify-end space-x-2 pt-4">
         <span class="text-sm text-gray-600 mr-auto">Status: {{ registrationStatus }}</span>
         <button type="button" @click="closeWindow" class="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">Cancel</button>
         <button type="submit" class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">Save & Register</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

// Refs for audio devices
const audioInputDevices = ref([]);
const audioOutputDevices = ref([]);

const config = ref({
  server: '',
  port: 5060,
  username: '',
  password: '',
  displayName: '',
  audioInputDeviceId: 'default', // Default device
  audioOutputDeviceId: 'default' // Default device
});

const registrationStatus = ref('Unknown');
let removeStatusListener = null;

// --- Methods ---

// Function to get audio devices
async function getAudioDevices() {
  try {
    // Request permission first (might be needed explicitly in some cases)
    await navigator.mediaDevices.getUserMedia({ audio: true });

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
    // Handle error - maybe show a message to the user
  }
}

async function loadSettings() {
  try {
    const currentConfig = await window.electronAPI.invoke('settings:get-config');
    if (currentConfig) {
      config.value = { ...config.value, ...currentConfig }; // Merge loaded config with defaults
    }
    // Also get initial registration status
    const initialStatus = await window.electronAPI.invoke('sip:get-registration-status');
    registrationStatus.value = initialStatus || 'Unknown';

  } catch (error) {
    console.error("Error loading settings:", error);
    registrationStatus.value = 'Error loading';
  }
}

async function saveSettings() {
  try {
    registrationStatus.value = 'Saving...';
    // Send only the relevant config fields to the main process
    await window.electronAPI.invoke('settings:save-config', JSON.parse(JSON.stringify(config.value)));
    registrationStatus.value = 'Registering...'; // Assume save triggers registration
    // No need to close window here, let main process handle feedback
  } catch (error) {
    console.error("Error saving settings:", error);
    registrationStatus.value = 'Error saving';
  }
}

function closeWindow() {
  // Ask the main process to close this specific window
  window.electronAPI.send('close-settings'); // Use the controller ID
}

// --- Lifecycle Hooks ---

onMounted(() => {
  loadSettings(); // Load SIP config first
  getAudioDevices(); // Then get audio devices

  // Listen for device changes (optional but good practice)
  navigator.mediaDevices.addEventListener('devicechange', getAudioDevices);

  // Listen for registration status updates from the main process
  removeStatusListener = window.electronAPI.on('sip:event:registration-status', (status) => {
    registrationStatus.value = status;
  });
});

onUnmounted(() => {
  // Clean up the listener when the component is unmounted
  if (removeStatusListener) {
    removeStatusListener();
  }
  // Remove device change listener
  navigator.mediaDevices.removeEventListener('devicechange', getAudioDevices);
});

</script>

<style>
/* Include base styles if needed, or rely on global import */
/* @import '../assets/base.css'; */
</style>

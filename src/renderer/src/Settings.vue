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

      <!-- Add more fields as needed (Transport, etc.) -->

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

const config = ref({
  server: '',
  port: 5060,
  username: '',
  password: '',
  displayName: ''
  // Add defaults for other fields
});

const registrationStatus = ref('Unknown');
let removeStatusListener = null;

// --- Methods ---

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
  loadSettings();

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
});

</script>

<style>
/* Include base styles if needed, or rely on global import */
/* @import '../assets/base.css'; */
</style>

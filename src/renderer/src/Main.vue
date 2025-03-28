<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100">
    <h1 class="text-4xl font-bold text-blue-600 mb-4">Hello World!</h1>
    <p class="text-lg text-gray-700">Welcome to your Electron + Vite + Vue + Tailwind Boilerplate.</p>
    <p class="mt-2 text-sm text-gray-500">App Version: {{ appVersion }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const appVersion = ref('Loading...')

onMounted(async () => {
  if (window.api && typeof window.api.getAppVersion === 'function') {
    try {
      appVersion.value = await window.api.getAppVersion();
    } catch (error) {
      console.error('Failed to get app version:', error);
      appVersion.value = 'Error';
    }
  } else {
    console.error('API or getAppVersion function not found');
    appVersion.value = 'N/A';
  }
});
</script>

<style>
/* Add any component-specific styles here if needed */
</style>

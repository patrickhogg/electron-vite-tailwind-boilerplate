<template>
  <div class="flex flex-col h-screen bg-gray-800 text-white font-sans">

    <!-- Header: Status & Settings -->
    <header class="flex items-center justify-between p-2 bg-gray-900 shadow-md">
      <span :class="statusColor" class="text-sm font-medium px-2 py-0.5 rounded">
        Status: {{ registrationStatus }}
      </span>
      <button @click="openSettings" class="text-gray-400 hover:text-white focus:outline-none">
        <!-- Simple Gear Icon (replace with SVG later if desired) -->
        <span class="text-xl">&#9881;</span>
      </button>
    </header>

    <!-- Main Content Area -->
    <main class="flex-grow flex flex-col items-center justify-center p-4 space-y-4">

      <!-- Call Info Display -->
      <div class="w-full max-w-xs text-center bg-gray-700 p-3 rounded-lg shadow">
        <div class="text-xs text-gray-400 mb-1">{{ callStateDisplay }}</div>
        <div class="text-2xl font-mono break-all h-8">{{ displayValue || '&nbsp;' }}</div>
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
        <button @click="handleCallAction" :disabled="!canCallOrAnswer"
                :class="callButtonClass"
                class="p-4 rounded-full text-white text-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 transition duration-150 ease-in-out">
          <!-- Phone Icon (replace with SVG later) -->
          &#128222;
        </button>
        <button @click="handleHangup" :disabled="!canHangup"
                class="p-4 rounded-full text-white text-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 transition duration-150 ease-in-out"
                :class="canHangup ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-gray-500 cursor-not-allowed'">
          <!-- Hangup Icon (replace with SVG later) -->
          &#128231;
        </button>
      </div>

       <!-- Audio Element for Remote Stream -->
       <audio ref="remoteAudio" autoplay="autoplay" style="display: none;"></audio>

       <!-- Error Display -->
       <div v-if="errorMessage" class="mt-2 text-red-400 text-sm text-center">
         {{ errorMessage }}
       </div>

    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

// --- Refs ---
const registrationStatus = ref('Loading...');
const callState = ref('Idle'); // Matches SipManager states
const incomingCallerId = ref('');
const enteredNumber = ref('');
const errorMessage = ref('');
const remoteAudio = ref(null); // Ref for the <audio> element

const dialPadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

// --- Listeners ---
let removeRegStatusListener = null;
let removeCallStateListener = null;
let removeErrorListener = null;
let removeStreamListener = null; // Listener for remote audio stream

// --- Computed Properties ---
const statusColor = computed(() => {
  switch (registrationStatus.value) {
    case 'Registered': return 'bg-green-600 text-white';
    case 'Connecting...':
    case 'Registering...': return 'bg-yellow-500 text-black';
    case 'Unregistered':
    case 'Failed':
    case 'Config Error':
    case 'Error': return 'bg-red-600 text-white';
    default: return 'bg-gray-500 text-white';
  }
});

const displayValue = computed(() => {
  if (callState.value === 'Incoming' || callState.value === 'Ringing') return incomingCallerId.value || 'Incoming Call';
  if (callState.value === 'Active' || callState.value === 'Held' || callState.value === 'Calling') return enteredNumber.value || incomingCallerId.value || 'Connecting...'; // Show number during active call
  return enteredNumber.value; // Show entered number otherwise
});

const callStateDisplay = computed(() => {
   if (callState.value === 'Incoming') return `Incoming: ${incomingCallerId.value || ''}`;
   return callState.value;
});

const canCallOrAnswer = computed(() => {
  if (registrationStatus.value !== 'Registered') return false;
  if (callState.value === 'Idle' && enteredNumber.value.length > 0) return true; // Can call
  if (callState.value === 'Incoming' || callState.value === 'Ringing') return true; // Can answer
  return false;
});

const canHangup = computed(() => {
  return ['Calling', 'Incoming', 'Ringing', 'Active', 'Held'].includes(callState.value);
});

const callButtonClass = computed(() => {
  if (!canCallOrAnswer.value) return 'bg-gray-500 cursor-not-allowed';
  if (callState.value === 'Incoming' || callState.value === 'Ringing') return 'bg-green-600 hover:bg-green-700 focus:ring-green-500 animate-pulse'; // Answer button style
  return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'; // Call button style
});


// --- Methods ---
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

function clearDisplay() {
    if (callState.value === 'Idle') {
        enteredNumber.value = '';
    }
}

function clearError() {
    errorMessage.value = '';
}

async function handleCallAction() {
  clearError();
  if (!canCallOrAnswer.value) return;

  if (callState.value === 'Idle' && enteredNumber.value.length > 0) {
    // Make Call
    try {
      console.log(`Making call to: ${enteredNumber.value}`);
      const success = await window.electronAPI.invoke('sip:make-call', enteredNumber.value);
      if (!success) {
          errorMessage.value = 'Failed to initiate call.';
          // State might be updated by SipManager already
      }
      // Call state will be updated via 'sip:event:call-state' listener
    } catch (error) {
      console.error("Error making call:", error);
      errorMessage.value = `Call Error: ${error.message || 'Unknown'}`;
      callState.value = 'Idle'; // Reset state on invoke error
    }
  } else if (callState.value === 'Incoming' || callState.value === 'Ringing') {
    // Answer Call
    try {
      console.log('Answering call...');
      const success = await window.electronAPI.invoke('sip:answer-call');
       if (!success) {
          errorMessage.value = 'Failed to answer call.';
          // State might be updated by SipManager already
      }
      // Call state will be updated via 'sip:event:call-state' listener
    } catch (error) {
      console.error("Error answering call:", error);
      errorMessage.value = `Answer Error: ${error.message || 'Unknown'}`;
      callState.value = 'Idle'; // Reset state on invoke error
    }
  }
}

async function handleHangup() {
  clearError();
  if (!canHangup.value) return;

  try {
    console.log('Hanging up call...');
    const success = await window.electronAPI.invoke('sip:hangup-call');
     if (!success) {
          errorMessage.value = 'Failed to hangup call.';
          // State might be updated by SipManager already
      } else {
          // Clear number display on successful hangup initiation
          // enteredNumber.value = ''; // Keep number for redial? Maybe clear on 'Ended' state instead.
      }
    // Call state will be updated via 'sip:event:call-state' listener
  } catch (error) {
    console.error("Error hanging up call:", error);
    errorMessage.value = `Hangup Error: ${error.message || 'Unknown'}`;
    callState.value = 'Idle'; // Force reset state on invoke error
  }
}

function openSettings() {
  clearError();
  console.log('Requesting to open settings window...');
  window.electronAPI.send('ui:open-settings-window');
}

// --- Lifecycle Hooks ---
onMounted(async () => {
  if (!window.electronAPI) {
    console.error("FATAL: electronAPI not found on window. Preload script likely failed.");
    registrationStatus.value = 'Error';
    errorMessage.value = 'Initialization Error.';
    return;
  }

  // Get initial status
  try {
      registrationStatus.value = await window.electronAPI.invoke('sip:get-registration-status');
      // Potentially get initial call state too if needed
      // callState.value = await window.electronAPI.invoke('sip:get-call-state');
  } catch(err) {
      console.error("Error getting initial status:", err);
      registrationStatus.value = 'Error';
  }


  // Listen for registration status updates
  removeRegStatusListener = window.electronAPI.on('sip:event:registration-status', (status) => {
    console.log('Renderer received sip:event:registration-status:', status);
    registrationStatus.value = status;
    // If registration fails or unregisters during a call, hang up?
    if (status !== 'Registered' && canHangup.value) {
        console.warn('Registration lost during active call. Attempting hangup.');
        handleHangup();
    }
  });

  // Listen for call state updates
  removeCallStateListener = window.electronAPI.on('sip:event:call-state', (data) => {
    console.log('Renderer received sip:event:call-state:', data);
    callState.value = data.state;
    incomingCallerId.value = data.callerId || ''; // Store caller ID if present

    // Clear number input when call ends or fails, unless it was an incoming call we didn't answer
     if (['Ended', 'Failed'].includes(data.state) ) {
         if (data.originator !== 'remote' || enteredNumber.value) { // Clear if we made the call or answered it
            enteredNumber.value = '';
         }
     }
     // Reset audio on hangup/end/fail
     if (['Idle', 'Ended', 'Failed'].includes(data.state) && remoteAudio.value) {
         remoteAudio.value.srcObject = null;
         remoteAudio.value.load(); // Reset audio element
     }
  });

  // Listen for general errors from SipManager
  removeErrorListener = window.electronAPI.on('sip:event:error', (message) => {
      console.error('Renderer received sip:event:error:', message);
      errorMessage.value = message;
      // Optionally clear error after a delay
      setTimeout(clearError, 5000);
  });

  // Listen for remote audio stream info (VERY BASIC - NEEDS PROPER IMPLEMENTATION)
  removeStreamListener = window.electronAPI.on('sip:event:remote-stream', (data) => {
      console.log('Renderer received sip:event:remote-stream:', data);
      // THIS IS THE CRITICAL PART - How to get the actual MediaStream?
      // JsSIP usually gives the stream in the 'addstream' or 'track' event on the RTCSession/PeerConnection.
      // The main process (SipManager) needs to capture this MediaStream object
      // and somehow transfer it or its tracks to the renderer.
      // This might involve:
      // 1. Electron's desktopCapturer (less likely for remote streams)
      // 2. WebRTC internals access (complex, potentially unstable)
      // 3. Custom IPC mechanism to transfer track data (very complex)
      // 4. A library specifically designed for Electron WebRTC stream sharing.

      // Placeholder: Assume we somehow got the stream object (THIS WON'T WORK AS IS)
      const remoteStream = data.stream; // This 'stream' needs to be the actual MediaStream object

      if (remoteAudio.value && remoteStream instanceof MediaStream) {
          console.log('Attempting to attach remote stream to audio element.');
          remoteAudio.value.srcObject = remoteStream;
          remoteAudio.value.play().catch(e => console.error("Audio play failed:", e));
      } else if (!remoteStream) {
           console.warn("Received remote stream event but stream data is missing or invalid.");
           errorMessage.value = "Error attaching remote audio.";
      } else {
           console.error("Remote audio element not found.");
           errorMessage.value = "Audio element error.";
      }
  });

});

onUnmounted(() => {
  // Clean up listeners
  if (removeRegStatusListener) removeRegStatusListener();
  if (removeCallStateListener) removeCallStateListener();
  if (removeErrorListener) removeErrorListener();
  if (removeStreamListener) removeStreamListener();
});

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

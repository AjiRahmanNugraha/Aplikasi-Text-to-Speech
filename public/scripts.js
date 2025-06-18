/**
 * Get references to DOM elements for user input and controls
 */
const fileInput = document.getElementById('fileInput'); // File input element for uploading text documents
const textInput = document.getElementById('textInput'); // Textarea for entering or displaying text to read
const languageSelect = document.getElementById('languageSelect'); // Dropdown to select language for speech synthesis
const voiceSelect = document.getElementById('voiceSelect'); // Dropdown to select voice for speech synthesis
const rateSelect = document.getElementById('rateSelect'); // Dropdown to select speech rate
const playBtn = document.getElementById('playBtn'); // Button to start speech synthesis
const pauseBtn = document.getElementById('pauseBtn'); // Button to pause speech synthesis
const stopBtn = document.getElementById('stopBtn'); // Button to stop speech synthesis
const statusDiv = document.getElementById('status'); // Div to display status messages to the user
const loadingIndicator = document.getElementById('loadingIndicator'); // Loading indicator shown during file upload

// Initialize speech synthesis API and related variables
let synth = window.speechSynthesis; // SpeechSynthesis instance
let voices = []; // Array to hold available voices
let utterance; // Current SpeechSynthesisUtterance object
let isPaused = false; // Flag to track if speech is paused

// Queue to hold chunks of text to be spoken sequentially
let utteranceQueue = [];
let currentUtteranceIndex = 0; // Index of the current chunk being spoken
let isPlaying = false; // Flag to track if speech is currently playing

/**
 * Populate the voiceSelect dropdown with voices available for the selected language
 */
function populateVoices() {
  voices = synth.getVoices();
  console.log('Available voices:', voices);
  const selectedLang = languageSelect.value;
  voiceSelect.innerHTML = ''; // Clear existing options
  // Filter voices by selected language prefix
  const filteredVoices = voices.filter(v => v.lang.startsWith(selectedLang));
  console.log('Filtered voices for language', selectedLang, ':', filteredVoices);
  if (filteredVoices.length === 0) {
    voiceSelect.innerHTML = '<option value="">No voices available for selected language</option>';
    return;
  }
  // Add filtered voices as options to the dropdown
  filteredVoices.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' [default]' : ''}`;
    voiceSelect.appendChild(option);
  });
}

/**
 * Split input text into chunks suitable for speech synthesis
 * @param {string} text - The full text to split
 * @param {number} maxLength - Maximum length of each chunk (default 160 characters)
 * @returns {string[]} Array of text chunks
 */
function splitTextIntoChunks(text, maxLength = 160) {
  // Split text into sentences using punctuation marks
  const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
  const chunks = [];
  let chunk = '';

  sentences.forEach(sentence => {
    if ((chunk + sentence).length > maxLength) {
      if (chunk) {
        chunks.push(chunk.trim());
        chunk = '';
      }
      if (sentence.length > maxLength) {
        // If single sentence is too long, split it forcibly into smaller parts
        for (let i = 0; i < sentence.length; i += maxLength) {
          chunks.push(sentence.substring(i, i + maxLength).trim());
        }
      } else {
        chunk = sentence;
      }
    } else {
      chunk += sentence + ' ';
    }
  });
  if (chunk) {
    chunks.push(chunk.trim());
  }
  return chunks;
}

/**
 * Play the queued utterances sequentially using speech synthesis
 */
function playUtteranceQueue() {
  // If all chunks have been spoken, update status and reset buttons
  if (currentUtteranceIndex >= utteranceQueue.length) {
    statusDiv.textContent = 'Finished reading';
    resetButtons();
    isPlaying = false;
    return;
  }

  // Create a new utterance for the current chunk
  utterance = new SpeechSynthesisUtterance(utteranceQueue[currentUtteranceIndex]);
  const selectedVoiceName = voiceSelect.value;
  const selectedVoice = voices.find(v => v.name === selectedVoiceName);
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  utterance.lang = languageSelect.value;
  utterance.rate = parseFloat(rateSelect.value);
  utterance.volume = 1;

  // Event handlers for utterance lifecycle
  utterance.onstart = () => {
    statusDiv.textContent = `Reading chunk ${currentUtteranceIndex + 1} of ${utteranceQueue.length}...`;
    playBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    isPlaying = true;
  };
  utterance.onpause = () => {
    statusDiv.textContent = 'Paused';
  };
  utterance.onresume = () => {
    statusDiv.textContent = 'Resumed';
  };
  utterance.onend = () => {
    currentUtteranceIndex++;
    playUtteranceQueue(); // Play next chunk recursively
  };
  utterance.onerror = (e) => {
    statusDiv.textContent = 'Error occurred: ' + e.error;
    resetButtons();
    isPlaying = false;
  };

  // Speak the utterance
  synth.speak(utterance);
}

/**
 * Event listener for Play button click
 * Handles starting or resuming speech synthesis
 */
playBtn.addEventListener('click', () => {
  if (voices.length === 0) {
    alert('Voices are not loaded yet. Please wait a moment and try again.');
    return;
  }
  if (synth.speaking) {
    if (isPaused) {
      synth.resume();
      isPaused = false;
      statusDiv.textContent = 'Resumed';
      pauseBtn.disabled = false;
      stopBtn.disabled = false;
      playBtn.disabled = true;
    }
    return;
  }
  if (textInput.value.trim() === '') {
    alert('Please enter or upload some text to read.');
    return;
  }
  if (textInput.value.trim().length < 5) {
    alert('Text is too short to read. Please enter more content.');
    return;
  }

  // Split text into chunks and start playing
  utteranceQueue = splitTextIntoChunks(textInput.value.trim());
  currentUtteranceIndex = 0;
  playUtteranceQueue();
});

/**
 * Event listener for Pause button click
 * Pauses speech synthesis if currently speaking
 */
pauseBtn.addEventListener('click', () => {
  if (synth.speaking && !synth.paused) {
    synth.pause();
    isPaused = true;
    pauseBtn.disabled = true;
    playBtn.disabled = false;
    statusDiv.textContent = 'Paused';
  }
});

/**
 * Event listener for Stop button click
 * Stops speech synthesis and resets state
 */
stopBtn.addEventListener('click', () => {
  if (synth.speaking) {
    synth.cancel();
    isPaused = false;
    statusDiv.textContent = 'Stopped';
    resetButtons();
    isPlaying = false;
    currentUtteranceIndex = 0;
    utteranceQueue = [];
  }
});

// Check if speechSynthesis API is supported by the browser
if (!('speechSynthesis' in window)) {
  alert('Warning: Your browser does not support Speech Synthesis API. Text-to-Speech functionality will not work.');
  playBtn.disabled = true;
}

// Some browsers load voices asynchronously, so listen for changes
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = populateVoices;
}

/**
 * Event listener for language selection change
 * Repopulates the voice list based on selected language
 */
languageSelect.addEventListener('change', () => {
  populateVoices();
});

/**
 * Event listener for file input change
 * Validates file type, uploads file to server, and loads returned text content
 */
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const allowedTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowedTypes.includes(file.type)) {
    alert('Only plain text (.txt), PDF (.pdf), and Word (.docx) files are supported.');
    fileInput.value = '';
    return;
  }
  const formData = new FormData();
  formData.append('document', file);

  // Show loading indicator and disable controls during upload
  loadingIndicator.style.display = 'inline';
  playBtn.disabled = true;
  pauseBtn.disabled = true;

  // Upload file to server endpoint /upload
  fetch('/upload', {
    method: 'POST',
    body: formData
  })
  .then(response => {
    loadingIndicator.style.display = 'none';
    playBtn.disabled = false;
    pauseBtn.disabled = true;
    if (!response.ok) {
      throw new Error('Failed to upload file');
    }
    return response.json();
  })
  .then(data => {
    // Load returned text content into textarea
    textInput.value = data.content;
    statusDiv.textContent = 'File uploaded and content loaded.';
    // Reset speech synthesis state after loading new text
    if (synth.speaking) {
      synth.cancel();
    }
    // Repopulate voices and reset buttons
    populateVoices();
    resetButtons();
  })
  .catch(error => {
    loadingIndicator.style.display = 'none';
    playBtn.disabled = false;
    pauseBtn.disabled = true;
    alert('Error uploading file: ' + error.message);
    statusDiv.textContent = 'Error uploading file.';
  });
});

/**
 * Reset the state of control buttons to default
 */
function resetButtons() {
  playBtn.disabled = false;
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
}

/**
 * Initialize voices and reset buttons on page load
 */
window.onload = () => {
  populateVoices();
  resetButtons();
};

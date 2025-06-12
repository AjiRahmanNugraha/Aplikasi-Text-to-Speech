const fileInput = document.getElementById('fileInput');
const textInput = document.getElementById('textInput');
const languageSelect = document.getElementById('languageSelect');
const voiceSelect = document.getElementById('voiceSelect');
const rateSelect = document.getElementById('rateSelect');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const loadingIndicator = document.getElementById('loadingIndicator');

let synth = window.speechSynthesis;
let voices = [];
let utterance;
let isPaused = false;

let utteranceQueue = [];
let currentUtteranceIndex = 0;
let isPlaying = false;

function populateVoices() {
  voices = synth.getVoices();
  console.log('Available voices:', voices);
  const selectedLang = languageSelect.value;
  voiceSelect.innerHTML = '';
  const filteredVoices = voices.filter(v => v.lang.startsWith(selectedLang));
  console.log('Filtered voices for language', selectedLang, ':', filteredVoices);
  if (filteredVoices.length === 0) {
    voiceSelect.innerHTML = '<option value="">No voices available for selected language</option>';
    return;
  }
  filteredVoices.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' [default]' : ''}`;
    voiceSelect.appendChild(option);
  });
}

function splitTextIntoChunks(text, maxLength = 160) {
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
        // If single sentence is too long, split it forcibly
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

function playUtteranceQueue() {
  if (currentUtteranceIndex >= utteranceQueue.length) {
    statusDiv.textContent = 'Finished reading';
    resetButtons();
    isPlaying = false;
    return;
  }

  utterance = new SpeechSynthesisUtterance(utteranceQueue[currentUtteranceIndex]);
  const selectedVoiceName = voiceSelect.value;
  const selectedVoice = voices.find(v => v.name === selectedVoiceName);
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  utterance.lang = languageSelect.value;
  utterance.rate = parseFloat(rateSelect.value);
  utterance.volume = 1;

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
    playUtteranceQueue();
  };
  utterance.onerror = (e) => {
    statusDiv.textContent = 'Error occurred: ' + e.error;
    resetButtons();
    isPlaying = false;
  };

  synth.speak(utterance);
}

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

  utteranceQueue = splitTextIntoChunks(textInput.value.trim());
  currentUtteranceIndex = 0;
  playUtteranceQueue();
});

pauseBtn.addEventListener('click', () => {
  if (synth.speaking && !synth.paused) {
    synth.pause();
    isPaused = true;
    pauseBtn.disabled = true;
    playBtn.disabled = false;
    statusDiv.textContent = 'Paused';
  }
});

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

// Check if speechSynthesis is supported
if (!('speechSynthesis' in window)) {
  alert('Warning: Your browser does not support Speech Synthesis API. Text-to-Speech functionality will not work.');
  playBtn.disabled = true;
}

// On some browsers voices may not be immediately available
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = populateVoices;
}

languageSelect.addEventListener('change', () => {
  populateVoices();
});

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

  loadingIndicator.style.display = 'inline';
  playBtn.disabled = true;
  pauseBtn.disabled = true;

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
    textInput.value = data.content;
    statusDiv.textContent = 'File uploaded and content loaded.';
    // Reset speech synthesis state after loading new text
    if (synth.speaking) {
      synth.cancel();
    }
    // Repopulate voices and reset voice selection
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

function resetButtons() {
  playBtn.disabled = false;
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
}

// Initialize voices on page load
window.onload = () => {
  populateVoices();
  resetButtons();
};

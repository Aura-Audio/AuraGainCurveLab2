/**
 * Main.js
 * Refactored for modularity, error handling, and MicManager integration.
 */

import { Engine } from './engine.js';
import { initMicManager, releaseMicStream, isMicAvailable } from './mic-manager.js';
import { WASM_CONFIG, loadDspModule } from './wasm.js';

// --- Constants ---
const NUM_ENGINES = 50;
const SOURCES = ['tone', 'mic', 'white', 'pink', 'brown'];
const DURATIONS = [2, 1, 0.5, 0.1, 0.01, 0.001]; // seconds

// --- State ---
let audioCtx = null;
let engines = [];
let wasmLoaded = false;
let masterSource = 'tone';
let masterDuration = 2;
let masterMonitorVolume = 1.0;
let masterAppVolume = 1.0;

// --- DOM Elements ---
const startAllBtn = document.getElementById('startAll');
const stopAllBtn = document.getElementById('stopAll');
const masterSourceSelect = document.getElementById('masterSource');
const masterDurationSelect = document.getElementById('masterDuration');
const masterMonitorVolumeSlider = document.getElementById('masterMonitorVolume');
const masterAppVolumeSlider = document.getElementById('masterAppVolume');
const engineCardsContainer = document.getElementById('engineCards');

// --- Initialization ---

async function initAudioContext() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: WASM_CONFIG.SAMPLE_RATE
    });
    console.log('AudioContext initialized.');
  } catch (err) {
    console.error('Failed to initialize AudioContext:', err);
    throw err;
  }
}

async function initWASM() {
  try {
    await loadDspModule();
    wasmLoaded = true;
    console.log('WASM loaded.');
  } catch (err) {
    console.warn('WASM fallback:', err.message);
    wasmLoaded = false;
  }
}

function initEngines() {
  engines = [];
  for (let i = 0; i < NUM_ENGINES; i++) {
    engines.push(new Engine(audioCtx, i));
  }
  console.log(`Initialized ${NUM_ENGINES} engines.`);
}

async function initMicManager() {
  if (!audioCtx) {
    throw new Error('AudioContext not initialized.');
  }
  initMicManager(audioCtx);
  const micAvailable = await isMicAvailable();
  if (!micAvailable) {
    console.warn('Mic not available. Disabling mic option.');
    disableMicOption();
  }
}

function disableMicOption() {
  const micOptions = masterSourceSelect.querySelectorAll('option[value="mic"]');
  micOptions.forEach(option => option.disabled = true);
}

// --- Engine Management ---

function startAllEngines() {
  engines.forEach(engine => {
    try {
      engine.setSource(masterSource);
      engine.setDuration(masterDuration);
      engine.setGain(masterMonitorVolume);
      engine.start();
    } catch (err) {
      console.error(`Failed to start engine ${engine.index}:`, err);
    }
  });
}

function stopAllEngines() {
  engines.forEach(engine => {
    try {
      engine.stop();
    } catch (err) {
      console.error(`Failed to stop engine ${engine.index}:`, err);
    }
  });
}

async function updateAllEnginesSource(source) {
  if (source === 'mic') {
    const micAvailable = await isMicAvailable();
    if (!micAvailable) {
      console.warn('Mic not available. Falling back to tone.');
      source = 'tone';
    }
  }

  masterSource = source;
  engines.forEach(engine => {
    try {
      engine.setSource(source);
    } catch (err) {
      console.error(`Failed to update source for engine ${engine.index}:`, err);
    }
  });
}

function updateAllEnginesDuration(duration) {
  masterDuration = parseFloat(duration);
  engines.forEach(engine => {
    try {
      engine.setDuration(masterDuration);
    } catch (err) {
      console.error(`Failed to update duration for engine ${engine.index}:`, err);
    }
  });
}

function updateAllEnginesMonitorVolume(volume) {
  masterMonitorVolume = parseFloat(volume);
  engines.forEach(engine => {
    try {
      engine.setGain(masterMonitorVolume);
    } catch (err) {
      console.error(`Failed to update monitor volume for engine ${engine.index}:`, err);
    }
  });
}

function updateMasterAppVolume(volume) {
  masterAppVolume = parseFloat(volume);
  // Apply to master output (implement as needed)
  console.log(`Master app volume set to ${masterAppVolume}.`);
}

// --- UI Setup ---

function setupEngineCards() {
  engineCardsContainer.innerHTML = '';
  engines.forEach(engine => {
    const card = createEngineCard(engine);
    engineCardsContainer.appendChild(card);
  });
}

function createEngineCard(engine) {
  const card = document.createElement('div');
  card.className = 'engine-card';
  card.dataset.index = engine.index;

  card.innerHTML = `
    <h3>Engine ${engine.index}</h3>
    <div class="controls">
      <button class="start-btn">▶</button>
      <button class="stop-btn">■</button>
      <select class="source-select">
        ${SOURCES.map(src => `<option value="${src}">${src}</option>`).join('')}
      </select>
      <select class="duration-select">
        ${DURATIONS.map(dur => `<option value="${dur}">${dur}s</option>`).join('')}
      </select>
      <input type="range" class="monitor-volume" min="0" max="1" step="0.01" value="1">
      <span class="gain-readout">Gain: 100%</span>
    </div>
    <canvas class="visualizer" width="200" height="100"></canvas>
  `;

  // Add event listeners
  card.querySelector('.start-btn').addEventListener('click', () => {
    try {
      engine.start();
    } catch (err) {
      console.error(`Engine ${engine.index} start failed:`, err);
    }
  });

  card.querySelector('.stop-btn').addEventListener('click', () => {
    try {
      engine.stop();
    } catch (err) {
      console.error(`Engine ${engine.index} stop failed:`, err);
    }
  });

  card.querySelector('.source-select').addEventListener('change', (e) => {
    try {
      engine.setSource(e.target.value);
    } catch (err) {
      console.error(`Engine ${engine.index} source update failed:`, err);
    }
  });

  card.querySelector('.duration-select').addEventListener('change', (e) => {
    try {
      engine.setDuration(parseFloat(e.target.value));
    } catch (err) {
      console.error(`Engine ${engine.index} duration update failed:`, err);
    }
  });

  card.querySelector('.monitor-volume').addEventListener('input', (e) => {
    try {
      engine.setGain(parseFloat(e.target.value));
    } catch (err) {
      console.error(`Engine ${engine.index} volume update failed:`, err);
    }
  });

  return card;
}

function setupGlobalControls() {
  startAllBtn.addEventListener('click', () => {
    try {
      startAllEngines();
    } catch (err) {
      console.error('Failed to start all engines:', err);
    }
  });

  stopAllBtn.addEventListener('click', () => {
    try {
      stopAllEngines();
    } catch (err) {
      console.error('Failed to stop all engines:', err);
    }
  });

  masterSourceSelect.addEventListener('change', (e) => {
    try {
      updateAllEnginesSource(e.target.value);
    } catch (err) {
      console.error('Failed to update master source:', err);
    }
  });

  masterDurationSelect.addEventListener('change', (e) => {
    try {
      updateAllEnginesDuration(e.target.value);
    } catch (err) {
      console.error('Failed to update master duration:', err);
    }
  });

  masterMonitorVolumeSlider.addEventListener('input', (e) => {
    try {
      updateAllEnginesMonitorVolume(e.target.value);
    } catch (err) {
      console.error('Failed to update master monitor volume:', err);
    }
  });

  masterAppVolumeSlider.addEventListener('input', (e) => {
    try {
      updateMasterAppVolume(e.target.value);
    } catch (err) {
      console.error('Failed to update master app volume:', err);
    }
  });
}

// --- Cleanup ---

function cleanup() {
  stopAllEngines();
  releaseMicStream();
  if (audioCtx) {
    audioCtx.close().then(() => {
      console.log('AudioContext closed.');
    });
  }
}

// --- Initialize App ---

async function init() {
  try {
    await initAudioContext();
    await initWASM();
    await initMicManager();
    initEngines();
    setupGlobalControls();
    setupEngineCards();
    console.log('App initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize app:', err);
    alert('Failed to initialize app. See console for details.');
  }
}

// --- Run ---

init();

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);

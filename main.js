/**
 * Main Entry — 50-Engine Rack with Safety Suite, Mobile Audio & Advanced Protections
 */

import { ENGINE_CONFIGS } from './gain-curves.js';
import { AudioEngine } from './engine.js';
import { loadDspModule, dbFromBuffer } from './wasm.js';
import { fitCanvas, drawScope, drawCurvePreview, drawPlayhead } from './visualizer.js';

const app = {
  engines: [],
  audioCtx: null,
  masterGain: null,
  masterAnalyser: null,
  masterBuf: null,
  limiter: null,
  silentKeeper: null,
  animHandle: null,
  initialized: false,
  wakeLock: null,
  soloEngineId: null,
  feedbackMuteTimer: null
};

const settings = {
  masterLimiter: true,
  micSafetyInterlock: true,
  concurrentEngineCap: true,
  aggregateLoudnessMeter: true,
  softStartRamp: true,
  soloMode: false,
  autoDucking: true,
  feedbackDetection: true,
  sessionVolumeMemory: true,
  engineCapCount: 8,
  micVolumeCap: 30,
  feedbackThreshold: 0.65,
  feedbackPersistFrames: 12
};

let micActiveCount = 0;

/* ───────── Session Volume Memory ───────── */
function getSessionVol(sourceType) {
  try {
    const raw = localStorage.getItem(`agl_vol_${sourceType}`);
    return raw !== null ? parseInt(raw) : null;
  } catch (e) { return null; }
}

function setSessionVol(sourceType, vol) {
  try { localStorage.setItem(`agl_vol_${sourceType}`, String(vol)); } catch (e) {}
}

async function init() {
  if (app.initialized) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    alert('Web Audio API is not supported in this browser.');
    return;
  }

  app.audioCtx = new AudioContext();
  unlockAudioContext(app.audioCtx);

  app.masterGain = app.audioCtx.createGain();
  app.masterGain.gain.value = 0.8;

  app.masterAnalyser = app.audioCtx.createAnalyser();
  app.masterAnalyser.fftSize = 2048;
  app.masterBuf = new Float32Array(2048);

  app.limiter = app.audioCtx.createDynamicsCompressor();
  app.limiter.threshold.value = -6;
  app.limiter.knee.value = 0;
  app.limiter.ratio.value = 20;
  app.limiter.attack.value = 0.003;
  app.limiter.release.value = 0.1;

  applyLimiterState();
  startSilentKeeper();
  setupMediaSession();
  setupLifecycleHandlers();

  try { await loadDspModule(); } catch (e) {
    console.warn('WASM optional load failed:', e);
  }

  const grid = document.getElementById('engineGrid');

  ENGINE_CONFIGS.forEach(config => {
    const engine = new AudioEngine(config, app.audioCtx);
    engine.softStartEnabled = settings.softStartRamp;
    engine.connectToDestination(app.masterGain);
    app.engines.push(engine);

    const card = buildCard(engine);
    grid.appendChild(card);

    const preview = card.querySelector('.curve-preview');
    drawCurvePreview(preview, config.curve, config.color);
  });

  setupMasterControls();
  setupSettingsPanel();

  window.addEventListener('resize', () => {
    app.engines.forEach(en => {
      const card = document.querySelector(`.engine-card[data-id="${en.id}"]`);
      if (card) {
        const preview = card.querySelector('.curve-preview');
        const scope = card.querySelector('.engine-scope');
        fitCanvas(preview);
        fitCanvas(scope);
        if (en.flatMode) {
          const flatCurve = () => en.flatGain;
          drawCurvePreview(preview, flatCurve, en.color);
        } else {
          drawCurvePreview(preview, en.config.curve, en.color);
        }
      }
    });
  });

  animate();
  app.initialized = true;
  updateGlobalStatus('Idle · 50 engines ready');
  console.log('AuraGainCurveLab — 50 engines ready');
}

/* ───────── Mobile Background Audio ───────── */

function unlockAudioContext(ctx) {
  if (ctx.state === 'running') return;
  const unlock = () => {
    if (ctx.state === 'suspended') ctx.resume();
    document.removeEventListener('touchstart', unlock);
    document.removeEventListener('click', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('touchstart', unlock, { once: true });
  document.addEventListener('click', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
}

function startSilentKeeper() {
  const ctx = app.audioCtx;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() - 0.5) * 0.0001;
  }
  const node = ctx.createBufferSource();
  node.buffer = buf;
  node.loop = true;
  node.connect(app.masterGain);
  node.start();
  app.silentKeeper = node;
}

function setupMediaSession() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'AuraGainCurveLab',
      artist: '50-Engine Rack',
      album: 'Signal Processing',
      artwork: []
    });
    navigator.mediaSession.playbackState = 'none';
    setInterval(() => {
      const anyRunning = app.engines.some(e => e.running);
      navigator.mediaSession.playbackState = anyRunning ? 'playing' : 'paused';
    }, 1000);
  }
}

function setupLifecycleHandlers() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      requestWakeLock();
    } else {
      if (app.audioCtx && app.audioCtx.state === 'suspended') {
        app.audioCtx.resume().catch(() => {});
      }
      releaseWakeLock();
    }
  });

  window.addEventListener('focus', () => {
    if (app.audioCtx && app.audioCtx.state === 'suspended') {
      app.audioCtx.resume().catch(() => {});
    }
  });

  window.addEventListener('pageshow', (e) => {
    if (e.persisted && app.audioCtx && app.audioCtx.state === 'suspended') {
      app.audioCtx.resume().catch(() => {});
    }
  });

  setInterval(() => {
    if (app.audioCtx && app.audioCtx.state === 'suspended') {
      app.audioCtx.resume().catch(() => {});
    }
  }, 2000);
}

async function requestWakeLock() {
  if ('wakeLock' in navigator && !app.wakeLock) {
    try {
      app.wakeLock = await navigator.wakeLock.request('screen');
      app.wakeLock.addEventListener('release', () => { app.wakeLock = null; });
    } catch (e) {}
  }
}

function releaseWakeLock() {
  if (app.wakeLock) {
    app.wakeLock.release().catch(() => {});
    app.wakeLock = null;
  }
}

/* ───────── Audio Graph & Controls ───────── */

function applyLimiterState() {
  if (!app.masterGain || !app.masterAnalyser || !app.limiter || !app.audioCtx) return;
  try { app.masterAnalyser.disconnect(); } catch (e) {}
  try { app.limiter.disconnect(); } catch (e) {}

  if (settings.masterLimiter) {
    app.masterGain.connect(app.masterAnalyser);
    app.masterAnalyser.connect(app.limiter);
    app.limiter.connect(app.audioCtx.destination);
  } else {
    app.masterGain.connect(app.masterAnalyser);
    app.masterAnalyser.connect(app.audioCtx.destination);
  }
}

function setupMasterControls() {
  document.getElementById('startAllBtn').addEventListener('click', async () => {
    if (settings.micSafetyInterlock && micActiveCount > 0) {
      updateGlobalStatus('Mic safety: Start All disabled');
      return;
    }

    updateGlobalStatus('Starting engines...');
    let started = 0;
    const runningCount = app.engines.filter(e => e.running).length;
    const cap = settings.concurrentEngineCap ? settings.engineCapCount : Infinity;
    const slots = cap - runningCount;

    for (const en of app.engines) {
      if (slots <= 0) break;
      if (!en.running) {
        try {
          await en.start();
          updatePlayButton(en.id, true);
          started++;
        } catch (err) {
          console.warn(`Engine ${en.id} failed:`, err.message);
        }
      }
    }

    const totalRunning = app.engines.filter(e => e.running).length;
    if (settings.concurrentEngineCap && started === 0 && runningCount >= cap) {
      updateGlobalStatus(`Cap reached — max ${cap} engines`);
    } else {
      updateGlobalStatus(`${totalRunning} engine(s) running`);
    }

    applyAutoDucking();
  });

  document.getElementById('stopAllBtn').addEventListener('click', () => {
    app.engines.forEach(en => {
      en.stop();
      updatePlayButton(en.id, false);
    });
    app.soloEngineId = null;
    updateGlobalStatus('All engines stopped');
  });

  document.getElementById('masterSource').addEventListener('change', e => {
    const type = e.target.value;

    // Session volume memory: restore remembered volume for this source type
    if (settings.sessionVolumeMemory) {
      const remembered = getSessionVol(type);
      if (remembered !== null) {
        const appSlider = document.getElementById('masterAppVol');
        appSlider.value = remembered;
        appSlider.dispatchEvent(new Event('input'));
      }
    }

    app.engines.forEach(en => {
      setEngineSource(en, type);
      const card = document.querySelector(`.engine-card[data-id="${en.id}"]`);
      if (card) {
        const sel = card.querySelector('.engine-source');
        if (sel) sel.value = type;
      }
    });
  });

  document.getElementById('masterDuration').addEventListener('change', e => {
    const dur = parseFloat(e.target.value);
    app.engines.forEach(en => {
      en.setCycleDuration(dur);
      const card = document.querySelector(`.engine-card[data-id="${en.id}"]`);
      if (card) {
        const sel = card.querySelector('.engine-dur');
        if (sel) sel.value = dur;
      }
    });
  });

  document.getElementById('masterMonitorVol').addEventListener('input', e => {
    const vol = parseInt(e.target.value);
    document.getElementById('masterMonitorVal').textContent = `${vol}%`;
    app.engines.forEach(en => {
      en.setMonitorVolume(vol);
      const card = document.querySelector(`.engine-card[data-id="${en.id}"]`);
      if (card) {
        const slider = card.querySelector('.engine-vol');
        if (slider) slider.value = vol;
      }
    });
  });

  document.getElementById('masterAppVol').addEventListener('input', e => {
    const vol = parseInt(e.target.value);
    document.getElementById('masterAppVal').textContent = `${vol}%`;
    if (app.masterGain) app.masterGain.gain.value = vol / 100;

    // Save to session memory for current source type
    if (settings.sessionVolumeMemory) {
      const currentSource = document.getElementById('masterSource').value;
      setSessionVol(currentSource, vol);
    }
  });

  document.getElementById('masterMode').addEventListener('change', e => {
    if (e.target.value === 'aligned') {
      applyAlignMode();
    } else {
      restoreUniqueMode();
    }
  });

  document.getElementById('masterAlignStep').addEventListener('change', e => {
    if (document.getElementById('masterMode').value === 'aligned') {
      applyAlignMode();
    }
  });

  document.getElementById('masterPolarity').addEventListener('change', e => {
    applyPolarity(e.target.value);
  });
}

function setupSettingsPanel() {
  const ids = {
    masterLimiter: 'settingLimiter',
    micSafetyInterlock: 'settingMicSafety',
    concurrentEngineCap: 'settingEngineCap',
    aggregateLoudnessMeter: 'settingAggMeter',
    softStartRamp: 'settingSoftStart',
    soloMode: 'settingSoloMode',
    autoDucking: 'settingAutoDuck',
    feedbackDetection: 'settingFeedbackDetect',
    sessionVolumeMemory: 'settingSessionVol'
  };

  Object.entries(ids).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = settings[key];
    el.addEventListener('change', e => {
      settings[key] = e.target.checked;
      applySetting(key);
    });
  });
}

function applySetting(key) {
  switch (key) {
    case 'masterLimiter':
      applyLimiterState();
      updateGlobalStatus(settings.masterLimiter ? 'Master limiter ON' : 'Master limiter OFF');
      break;
    case 'softStartRamp':
      app.engines.forEach(en => { en.softStartEnabled = settings.softStartRamp; });
      updateGlobalStatus(settings.softStartRamp ? 'Soft-start ON' : 'Soft-start OFF');
      break;
    case 'micSafetyInterlock':
      updateMicSafetyState();
      break;
    case 'concurrentEngineCap':
      updateGlobalStatus(settings.concurrentEngineCap ? `Engine cap: ${settings.engineCapCount}` : 'Engine cap OFF');
      break;
    case 'aggregateLoudnessMeter':
      const meter = document.getElementById('masterMeterWrap');
      if (meter) meter.style.display = settings.aggregateLoudnessMeter ? 'flex' : 'none';
      updateGlobalStatus(settings.aggregateLoudnessMeter ? 'Aggregate meter ON' : 'Aggregate meter OFF');
      break;
    case 'soloMode':
      if (!settings.soloMode) app.soloEngineId = null;
      updateGlobalStatus(settings.soloMode ? 'Solo mode ON — one engine at a time' : 'Solo mode OFF');
      break;
    case 'autoDucking':
      applyAutoDucking();
      updateGlobalStatus(settings.autoDucking ? 'Auto-ducking ON' : 'Auto-ducking OFF');
      break;
    case 'feedbackDetection':
      updateGlobalStatus(settings.feedbackDetection ? 'Feedback detection ON' : 'Feedback detection OFF');
      break;
    case 'sessionVolumeMemory':
      updateGlobalStatus(settings.sessionVolumeMemory ? 'Session volume memory ON' : 'Session volume memory OFF');
      break;
  }
}

/* ───────── Solo Mode ───────── */

function enforceSoloMode(startedId) {
  if (!settings.soloMode) return;
  app.soloEngineId = startedId;
  app.engines.forEach(en => {
    if (en.id !== startedId && en.running) {
      en.stop();
      updatePlayButton(en.id, false);
    }
  });
}

/* ───────── Auto-Ducking ───────── */

function applyAutoDucking() {
  if (!settings.autoDucking) {
    // Restore all engines to their nominal monitor volume
    const masterVol = parseInt(document.getElementById('masterMonitorVol').value);
    app.engines.forEach(en => {
      if (en.running) en.setMonitorVolume(masterVol);
    });
    return;
  }

  const running = app.engines.filter(e => e.running);
  const count = running.length;
  if (count <= 1) {
    const masterVol = parseInt(document.getElementById('masterMonitorVol').value);
    running.forEach(en => en.setMonitorVolume(masterVol));
    return;
  }

  // Duck proportionally: total perceived loudness ≈ constant
  // Using square-root law for perceptual mixing
  const masterVol = parseInt(document.getElementById('masterMonitorVol').value);
  const duckFactor = 1 / Math.sqrt(count);
  const duckedVol = Math.round(masterVol * duckFactor);

  running.forEach(en => {
    en.setMonitorVolume(duckedVol);
    const card = document.querySelector(`.engine-card[data-id="${en.id}"]`);
    if (card) {
      const slider = card.querySelector('.engine-vol');
      if (slider) slider.value = duckedVol;
    }
  });

  updateGlobalStatus(`Auto-duck: ${count} engines → ${duckedVol}% each`);
}

/* ───────── Feedback Detection ───────── */

function detectFeedback() {
  if (!settings.feedbackDetection || micActiveCount === 0) return false;

  let feedbackDetected = false;

  app.engines.forEach(en => {
    if (en.sourceType !== 'mic' || !en.feedbackAnalyser) return;

    en.feedbackAnalyser.getByteFrequencyData(en.freqData);
    const len = en.freqData.length;
    const sampleRate = app.audioCtx.sampleRate;

    // Look for persistent peaks in the 2–8 kHz range (typical feedback zone)
    const binLow = Math.floor(2000 * len / (sampleRate / 2));
    const binHigh = Math.floor(8000 * len / (sampleRate / 2));

    let maxVal = 0;
    let maxBin = 0;
    for (let i = binLow; i <= binHigh && i < len; i++) {
      if (en.freqData[i] > maxVal) {
        maxVal = en.freqData[i];
        maxBin = i;
      }
    }

    const normalized = maxVal / 255;
    en.feedbackHistory.push(normalized);
    if (en.feedbackHistory.length > settings.feedbackPersistFrames) {
      en.feedbackHistory.shift();
    }

    // Check if peak has persisted above threshold for required frames
    if (en.feedbackHistory.length >= settings.feedbackPersistFrames) {
      const allAbove = en.feedbackHistory.every(v => v > settings.feedbackThreshold);
      if (allAbove) {
        feedbackDetected = true;
        // Mark which bin triggered it
        const freq = Math.round(maxBin * (sampleRate / 2) / len);
        console.warn(`Feedback detected on engine ${en.id} at ~${freq} Hz`);
      }
    }
  });

  return feedbackDetected;
}

function handleFeedbackDetected() {
  // Auto-mute all mic engines
  app.engines.forEach(en => {
    if (en.sourceType === 'mic' && en.running) {
      en.stop();
      updatePlayButton(en.id, false);
    }
  });

  // Switch all mic engines to tone
  app.engines.forEach(en => {
    if (en.sourceType === 'mic') {
      setEngineSource(en, 'tone').catch(() => {});
      const card = document.querySelector(`.engine-card[data-id="${en.id}"]`);
      if (card) {
        const sel = card.querySelector('.engine-source');
        if (sel) sel.value = 'tone';
      }
    }
  });

  // Show warning
  const banner = document.getElementById('micBanner');
  banner.innerHTML = `
    <span class="mic-icon">⚠️</span>
    <div>
      <b>Feedback Detected — Mic Auto-Muted</b>
      <span>A persistent tonal peak was detected. All mic engines switched to tone for safety.</span>
    </div>
  `;
  banner.style.display = 'flex';
  banner.style.background = 'linear-gradient(90deg, #5a1f1f, #3a0f0f)';
  banner.style.borderColor = 'var(--danger)';

  // Clear the warning after 5 seconds
  if (app.feedbackMuteTimer) clearTimeout(app.feedbackMuteTimer);
  app.feedbackMuteTimer = setTimeout(() => {
    updateMicSafetyState();
  }, 5000);

  updateGlobalStatus('Feedback auto-mute triggered');
}

/* ───────── Engine Source & Safety ───────── */

async function setEngineSource(engine, type) {
  const wasMic = engine.sourceType === 'mic';
  await engine.setSource(type);
  const isMic = type === 'mic';

  if (wasMic && !isMic) micActiveCount--;
  if (!wasMic && isMic) micActiveCount++;

  updateMicSafetyState();
}

function updateMicSafetyState() {
  const banner = document.getElementById('micBanner');
  const startAllBtn = document.getElementById('startAllBtn');
  const appVolSlider = document.getElementById('masterAppVol');

  if (settings.micSafetyInterlock && micActiveCount > 0) {
    banner.innerHTML = `
      <span class="mic-icon">🎤</span>
      <div>
        <b>Microphone Active — Use Headphones</b>
        <span>Master volume capped at 30%. Start All is disabled to prevent feedback.</span>
      </div>
    `;
    banner.style.background = 'linear-gradient(90deg, #5a3319, #3a1f0f)';
    banner.style.borderColor = 'var(--danger)';
    banner.style.display = 'flex';
    startAllBtn.disabled = true;
    startAllBtn.classList.add('disabled');

    const cap = settings.micVolumeCap;
    if (parseInt(appVolSlider.value) > cap) {
      appVolSlider.value = cap;
      appVolSlider.dispatchEvent(new Event('input'));
    }
  } else {
    banner.style.display = 'none';
    startAllBtn.disabled = false;
    startAllBtn.classList.remove('disabled');
  }
}

function applyAlignMode() {
  const step = parseInt(document.getElementById('masterAlignStep').value) / 100;
  app.engines.forEach((en, idx) => {
    const gain = Math.max(0.01, 1.0 - idx * step);
    en.setFlatMode(true, gain);
    const card = document.querySelector(`.engine-card[data-id="${en.id}"]`);
    if (card) {
      const badge = card.querySelector('.mode-badge');
      badge.textContent = `FLAT ${Math.round(gain * 100)}%`;
      badge.style.display = 'inline-block';
    }
  });
  updateGlobalStatus('Align mode — flat gains descending');
}

function restoreUniqueMode() {
  app.engines.forEach(en => {
    en.setFlatMode(false, 1.0);
    const card = document.querySelector(`.engine-card[data-id="${en.id}"]`);
    if (card) card.querySelector('.mode-badge').style.display = 'none';
  });
  updateGlobalStatus('Unique curves restored');
}

function applyPolarity(rule) {
  app.engines.forEach((en, idx) => {
    let invert = false;
    switch (rule) {
      case 'none': invert = false; break;
      case 'all': invert = true; break;
      case '2nd': invert = (idx + 1) % 2 === 0; break;
      case '3rd': invert = (idx + 1) % 3 === 0; break;
      case '4th': invert = (idx + 1) % 4 === 0; break;
      case '5th': invert = (idx + 1) % 5 === 0; break;
    }
    en.setPolarity(invert);
    const card = document.querySelector(`.engine-card[data-id="${en.id}"]`);
    if (card) {
      card.classList.toggle('polarity-inverted', invert);
      const badge = card.querySelector('.polarity-badge');
      badge.style.display = invert ? 'inline-block' : 'none';
    }
  });
}

function updateGlobalStatus(text) {
  const el = document.getElementById('globalStatus');
  if (el) el.textContent = text;
}

function buildCard(engine) {
  const div = document.createElement('div');
  div.className = 'engine-card';
  div.dataset.id = engine.id;

  div.innerHTML = `
    <div class="engine-header" style="border-color:${engine.color}">
      <div>
        <div class="engine-num">#${String(engine.id).padStart(2, '0')}</div>
        <div class="engine-name">${engine.name}</div>
        <div class="engine-tag">${engine.tag}</div>
        <span class="mode-badge" style="display:none;">FLAT</span>
        <span class="polarity-badge" style="display:none;">Ø INV</span>
      </div>
      <button class="engine-playbtn" data-id="${engine.id}" title="Start/Stop engine">▶</button>
    </div>
    <canvas class="curve-preview" width="300" height="60"></canvas>
    <div class="engine-scope-wrap">
      <canvas class="engine-scope" id="scope-${engine.id}" width="300" height="80"></canvas>
    </div>
    <div class="engine-controls">
      <select class="engine-source" data-id="${engine.id}">
        <option value="tone" selected>Tone</option>
        <option value="mic">Mic</option>
        <option value="white">White</option>
        <option value="pink">Pink</option>
        <option value="brown">Brown</option>
      </select>
      <select class="engine-dur" data-id="${engine.id}">
        <option value="2">2 s</option>
        <option value="1">1 s</option>
        <option value="0.5" selected>0.5 s</option>
        <option value="0.1">0.1 s</option>
        <option value="0.05">0.05 s</option>
        <option value="0.01">0.01 s</option>
        <option value="0.005">0.005 s</option>
        <option value="0.001">0.001 s</option>
      </select>
      <input type="range" class="engine-vol" data-id="${engine.id}" min="0" max="100" value="20" title="Monitor volume">
    </div>
    <div class="engine-readout">
      <span>Gain: <b class="gain-pct" style="color:${engine.color}">100%</b></span>
      <span>Δ dB: <b class="delta-db">0.0</b></span>
    </div>
  `;

  const playBtn = div.querySelector('.engine-playbtn');
  playBtn.addEventListener('click', async () => {
    if (engine.running) {
      engine.stop();
      updatePlayButton(engine.id, false);
      applyAutoDucking();
    } else {
      try {
        // Solo mode: stop all others first
        if (settings.soloMode) {
          enforceSoloMode(engine.id);
        }
        await engine.start();
        updatePlayButton(engine.id, true);
        applyAutoDucking();
      } catch (err) {
        alert(`Engine ${engine.id}: ${err.message}`);
      }
    }
  });

  const sourceSel = div.querySelector('.engine-source');
  sourceSel.addEventListener('change', e => {
    setEngineSource(engine, e.target.value).catch(err => alert(err.message));
  });

  const durSel = div.querySelector('.engine-dur');
  durSel.addEventListener('change', e => {
    engine.setCycleDuration(parseFloat(e.target.value));
  });

  const volSlider = div.querySelector('.engine-vol');
  volSlider.addEventListener('input', e => {
    engine.setMonitorVolume(parseInt(e.target.value));
  });

  return div;
}

function updatePlayButton(id, running) {
  const btn = document.querySelector(`.engine-playbtn[data-id="${id}"]`);
  if (!btn) return;
  btn.textContent = running ? '■' : '▶';
  btn.classList.toggle('running', running);
}

function animate() {
  app.engines.forEach(engine => {
    const card = document.querySelector(`.engine-card[data-id="${engine.id}"]`);
    if (!card) return;

    const preview = card.querySelector('.curve-preview');
    const scope = card.querySelector('.engine-scope');

    if (engine.flatMode) {
      const flatCurve = () => engine.flatGain;
      drawCurvePreview(preview, flatCurve, engine.color);
    } else {
      drawCurvePreview(preview, engine.gainCurve, engine.color);
      drawPlayhead(preview, engine.getCurrentPhase(), engine.gainCurve, engine.color);
    }

    if (engine.running) {
      const { byteAfter } = engine.getAnalyserData();
      drawScope(scope, byteAfter, engine.color);

      const { dbBefore, dbAfter } = engine.getDbValues();
      const gainPct = engine.getCurrentGainPct();
      card.querySelector('.gain-pct').textContent = `${gainPct}%`;

      const delta = (dbBefore <= -79 || dbAfter <= -79) ? 0 : (dbBefore - dbAfter);
      card.querySelector('.delta-db').textContent = `${delta.toFixed(1)} dB`;
    }
  });

  // Aggregate master loudness meter
  if (settings.aggregateLoudnessMeter && app.masterAnalyser) {
    app.masterAnalyser.getFloatTimeDomainData(app.masterBuf);
    const db = dbFromBuffer(app.masterBuf, 0);
    const meterText = document.getElementById('masterMeterText');
    const meterBar = document.getElementById('masterMeterBar');
    if (meterText && meterBar) {
      const displayDb = db <= -79 ? '−∞' : db.toFixed(1);
      meterText.textContent = `Master Output: ${displayDb} dB`;
      const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
      meterBar.style.width = `${pct}%`;
      if (db > -1) {
        meterBar.style.background = 'var(--danger)';
      } else if (db > -6) {
        meterBar.style.background = 'var(--warn)';
      } else {
        meterBar.style.background = 'linear-gradient(90deg, #1f4b47, var(--ok))';
      }
    }
  }

  // Feedback detection (run every frame for responsiveness)
  if (settings.feedbackDetection && detectFeedback()) {
    handleFeedbackDetected();
  }

  app.animHandle = requestAnimationFrame(animate);
}

window.addEventListener('beforeunload', () => {
  if (app.animHandle) cancelAnimationFrame(app.animHandle);
  releaseWakeLock();
  app.engines.forEach(e => e.cleanup());
  if (app.audioCtx) app.audioCtx.close();
});

document.addEventListener('DOMContentLoaded', init);

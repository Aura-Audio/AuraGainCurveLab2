/**
 * AudioEngine — Self-contained gain-curve track with flat-mode, polarity & soft-start
 * FIXED: Atomic source changes — sourceType only updated after successful node creation
 */

import { createNoiseBuffer, dbFromBuffer } from './wasm.js';

const MIN_CYCLE_DURATION = 0.001;

export class AudioEngine {
  constructor(config, sharedAudioCtx) {
    this.config = config;
    this.id = config.id;
    this.name = config.name;
    this.tag = config.tag;
    this.color = config.color;
    this.gainCurve = config.curve;

    this.audioCtx = sharedAudioCtx;
    this.running = false;
    this.sourceType = 'tone';
    this.cycleDuration = 0.5;
    this.segmentT0 = 0;
    this.schedulerHandle = null;
    this.sourceNode = null;
    this.micStream = null;
    this.monitorVolume = 0.2;
    this.softStartEnabled = true;

    this.flatMode = false;
    this.flatGain = 1.0;

    this.gainBefore = this.audioCtx.createGain();
    this.gainBefore.gain.value = 1.0;
    this.analyserBefore = this.audioCtx.createAnalyser();
    this.analyserBefore.fftSize = 2048;
    this.gainBefore.connect(this.analyserBefore);

    // Feedback detection analyser (frequency domain)
    this.feedbackAnalyser = this.audioCtx.createAnalyser();
    this.feedbackAnalyser.fftSize = 2048;
    this.feedbackAnalyser.smoothingTimeConstant = 0.8;
    this.gainBefore.connect(this.feedbackAnalyser);
    this.freqData = new Uint8Array(2048);
    this.feedbackHistory = [];

    this.gainAfter = this.audioCtx.createGain();
    this.gainAfter.gain.value = 1.0;

    this.polarityNode = this.audioCtx.createGain();
    this.polarityNode.gain.value = 1.0;

    this.analyserAfter = this.audioCtx.createAnalyser();
    this.analyserAfter.fftSize = 2048;

    this.monitorGain = this.audioCtx.createGain();
    this.monitorGain.gain.value = 0;

    this.gainAfter.connect(this.polarityNode);
    this.polarityNode.connect(this.analyserAfter);
    this.analyserAfter.connect(this.monitorGain);

    this.bufBefore = new Float32Array(2048);
    this.bufAfter = new Float32Array(2048);
    this.byteBefore = new Uint8Array(2048);
    this.byteAfter = new Uint8Array(2048);
  }

  connectToDestination(dest) {
    this.monitorGain.connect(dest);
  }

  disconnectFromDestination() {
    try { this.monitorGain.disconnect(); } catch (e) {}
  }

  /**
   * FIXED: Atomic source change.
   * 1. Disconnect old source
   * 2. Try to create new source
   * 3. Only update this.sourceType if creation succeeds
   * 4. If creation fails, old sourceType is preserved and caller handles cleanup
   */
  async setSource(type) {
    const valid = ['mic', 'tone', 'white', 'pink', 'brown'];
    if (!valid.includes(type)) throw new Error(`Invalid source: ${type}`);

    // Always disconnect old source first
    this._disconnectSource();

    // If engine is not running, just update type — no node needed
    if (!this.running) {
      this.sourceType = type;
      return;
    }

    // Engine is running — must create a new source node atomically
    let newNode = null;
    let newStream = null;

    try {
      if (type === 'mic') {
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
        newNode = this.audioCtx.createMediaStreamSource(newStream);
      } else if (type === 'tone') {
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 440;
        osc.start();
        newNode = osc;
      } else {
        const buf = createNoiseBuffer(this.audioCtx, type);
        if (!buf) throw new Error(`Failed to create ${type} noise buffer`);
        const node = this.audioCtx.createBufferSource();
        node.buffer = buf;
        node.loop = true;
        node.start();
        newNode = node;
      }
    } catch (err) {
      // Creation failed — do NOT update sourceType
      // Leave engine without a source node; caller can retry or handle error
      console.warn(`Engine ${this.id}: failed to create ${type} source —`, err.message);
      throw err;
    }

    // Success — wire up the new source
    this.sourceNode = newNode;
    this.micStream = newStream;
    this.sourceType = type;

    this.sourceNode.connect(this.gainBefore);
    this.sourceNode.connect(this.gainAfter);
  }

  _disconnectSource() {
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (e) {}
      if (this.sourceNode.stop) {
        try { this.sourceNode.stop(); } catch (e) {}
      }
      this.sourceNode = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
  }

  resetRampBaseline() {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    this.gainAfter.gain.cancelScheduledValues(now);
    this.gainAfter.gain.setValueAtTime(1.0, now);
    this.segmentT0 = now;
  }

  async start() {
    if (this.running) return;
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();

    await this.setSource(this.sourceType);

    if (this.audioCtx && this.softStartEnabled) {
      const now = this.audioCtx.currentTime;
      this.monitorGain.gain.cancelScheduledValues(now);
      this.monitorGain.gain.setValueAtTime(0, now);
      this.monitorGain.gain.linearRampToValueAtTime(this.monitorVolume, now + 0.1);
    } else {
      this.monitorGain.gain.value = this.monitorVolume;
    }

    if (this.flatMode) {
      const now = this.audioCtx.currentTime;
      this.gainAfter.gain.cancelScheduledValues(now);
      this.gainAfter.gain.setValueAtTime(this.flatGain, now);
    } else {
      this.resetRampBaseline();
    }

    this.running = true;

    if (!this.flatMode) {
      this.schedulerTick();
      this.schedulerHandle = setInterval(() => this.schedulerTick(), 25);
    }
  }

  stop() {
    this.running = false;
    if (this.schedulerHandle) {
      clearInterval(this.schedulerHandle);
      this.schedulerHandle = null;
    }
    this._disconnectSource();

    const now = this.audioCtx.currentTime;
    this.gainAfter.gain.cancelScheduledValues(now);
    this.gainAfter.gain.setValueAtTime(1.0, now);

    if (this.audioCtx) {
      this.monitorGain.gain.cancelScheduledValues(now);
      this.monitorGain.gain.setValueAtTime(0, now);
    }
  }

  schedulerTick() {
    if (!this.running || this.flatMode) return;
    const lookahead = 0.25;
    const now = this.audioCtx.currentTime;
    const cycle = this.cycleDuration;

    let n = Math.floor((now - this.segmentT0) / cycle);
    let nextStart = this.segmentT0 + n * cycle;

    while (nextStart < now + lookahead) {
      if (nextStart >= now - 0.001) {
        this._scheduleCycle(nextStart, cycle);
      }
      nextStart += cycle;
    }
  }

  _scheduleCycle(startTime, duration) {
    const g = this.gainAfter.gain;
    g.setValueAtTime(1.0, startTime);

    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      const phase = i / steps;
      const gainVal = this.gainCurve(phase);
      const t = startTime + phase * duration;
      g.linearRampToValueAtTime(Math.max(0.001, gainVal), t);
    }

    g.setValueAtTime(1.0, startTime + duration);
  }

  setCycleDuration(d) {
    this.cycleDuration = Math.max(MIN_CYCLE_DURATION, parseFloat(d));
    if (this.running && !this.flatMode) this.resetRampBaseline();
  }

  setMonitorVolume(v) {
    this.monitorVolume = Math.max(0, Math.min(100, v)) / 100;
    if (this.running && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.monitorGain.gain.setTargetAtTime(this.monitorVolume, now, 0.01);
    }
  }

  updateTone(waveform, freq) {
    if (this.sourceType === 'tone' && this.sourceNode) {
      this.sourceNode.type = waveform;
      this.sourceNode.frequency.value = freq;
    }
  }

  setFlatMode(enabled, gainValue) {
    this.flatMode = enabled;
    this.flatGain = Math.max(0.01, Math.min(1.0, gainValue));

    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    if (enabled) {
      if (this.schedulerHandle) {
        clearInterval(this.schedulerHandle);
        this.schedulerHandle = null;
      }
      this.gainAfter.gain.cancelScheduledValues(now);
      this.gainAfter.gain.setValueAtTime(this.flatGain, now);
    } else {
      if (this.running) {
        this.resetRampBaseline();
        this.schedulerTick();
        this.schedulerHandle = setInterval(() => this.schedulerTick(), 25);
      }
    }
  }

  setPolarity(inverted) {
    if (this.polarityNode) {
      this.polarityNode.gain.value = inverted ? -1.0 : 1.0;
    }
  }

  getAnalyserData() {
    this.analyserBefore.getFloatTimeDomainData(this.bufBefore);
    this.analyserAfter.getFloatTimeDomainData(this.bufAfter);
    this.analyserBefore.getByteTimeDomainData(this.byteBefore);
    this.analyserAfter.getByteTimeDomainData(this.byteAfter);
    return {
      bufBefore: this.bufBefore,
      bufAfter: this.bufAfter,
      byteBefore: this.byteBefore,
      byteAfter: this.byteAfter
    };
  }

  getDbValues() {
    const { bufBefore, bufAfter } = this.getAnalyserData();
    const dbB = dbFromBuffer(bufBefore, 0);
    const dbA = dbFromBuffer(bufAfter, 0);
    return {
      dbBefore: dbB <= -79 ? -Infinity : dbB,
      dbAfter: dbA <= -79 ? -Infinity : dbA
    };
  }

  getCurrentGainPct() {
    if (this.flatMode) return Math.round(this.flatGain * 100);
    if (!this.running) return 100;
    const elapsed = (this.audioCtx.currentTime - this.segmentT0) % this.cycleDuration;
    const phase = elapsed / this.cycleDuration;
    return Math.round(this.gainCurve(phase) * 100);
  }

  getCurrentPhase() {
    if (this.flatMode || !this.running) return 0;
    const elapsed = (this.audioCtx.currentTime - this.segmentT0) % this.cycleDuration;
    return elapsed / this.cycleDuration;
  }

  cleanup() {
    this.stop();
    this.disconnectFromDestination();
    try { this.gainBefore.disconnect(); } catch (e) {}
    try { this.gainAfter.disconnect(); } catch (e) {}
    try { this.polarityNode.disconnect(); } catch (e) {}
    try { this.analyserBefore.disconnect(); } catch (e) {}
    try { this.feedbackAnalyser.disconnect(); } catch (e) {}
    try { this.analyserAfter.disconnect(); } catch (e) {}
  }
}

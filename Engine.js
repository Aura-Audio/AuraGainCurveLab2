/**
 * Engine.js
 * Refactored to use MicManager, add error handling, and clean up audio nodes.
 */

import { getMicStream } from './mic-manager.js';

const SOURCES = {
  TONE: 'tone',
  MIC: 'mic',
  WHITE: 'white',
  PINK: 'pink',
  BROWN: 'brown'
};

const GAIN_CURVES = {
  // ... (import or define your gain curves here)
};

export class Engine {
  constructor(audioCtx, index) {
    this.audioCtx = audioCtx;
    this.index = index;
    this.status = 'idle'; // 'idle', 'starting', 'running', 'stopped', 'error'
    this.sourceType = SOURCES.TONE;
    this.oscillator = null;
    this.gainNode = audioCtx.createGain();
    this.inputNode = null;
    this.outputNode = audioCtx.createGain();
    this.destination = audioCtx.destination;
    this.gainValue = 1.0;
    this.duration = 2.0; // seconds
    this.curve = 'linear';

    // Connect nodes
    this.inputNode = this.createDefaultSource();
    this.inputNode.connect(this.gainNode);
    this.gainNode.connect(this.outputNode);
    this.outputNode.connect(this.destination);
  }

  // --- Source Management ---

  createDefaultSource() {
    const oscillator = this.audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 440;
    oscillator.start();
    return oscillator;
  }

  createNoiseSource(type) {
    // Placeholder for noise source creation (WASM or JS fallback)
    // Integrate with your existing noise generation logic
    const noise = this.audioCtx.createBufferSource();
    // ... (set buffer for noise type)
    noise.loop = true;
    noise.start();
    return noise;
  }

  async setSource(source) {
    if (this.status === 'error') {
      console.warn(`Engine ${this.index}: Cannot set source in error state.`);
      return;
    }

    this.status = 'starting';
    try {
      // Disconnect current input
      if (this.inputNode) {
        this.inputNode.disconnect();
      }

      // Create new input based on source
      switch (source) {
        case SOURCES.TONE:
          this.inputNode = this.createDefaultSource();
          break;
        case SOURCES.MIC:
          this.inputNode = await getMicStream();
          break;
        case SOURCES.WHITE:
        case SOURCES.PINK:
        case SOURCES.BROWN:
          this.inputNode = this.createNoiseSource(source);
          break;
        default:
          throw new Error(`Unknown source: ${source}`);
      }

      this.sourceType = source;
      this.inputNode.connect(this.gainNode);
      this.status = 'running';
      console.log(`Engine ${this.index}: Source set to ${source}.`);
    } catch (err) {
      console.error(`Engine ${this.index}: Failed to set source ${source}:`, err);
      this.status = 'error';
      this.inputNode = this.createDefaultSource(); // Fallback to tone
      this.inputNode.connect(this.gainNode);
    }
  }

  // --- Gain Management ---

  setGain(value) {
    this.gainValue = Math.max(0, Math.min(1, value));
    this.gainNode.gain.value = this.gainValue;
  }

  setGainCurve(curve) {
    this.curve = curve;
    // Apply curve logic here (e.g., for automation)
  }

  // --- Duration Management ---

  setDuration(duration) {
    this.duration = Math.max(0.001, duration);
  }

  // --- Lifecycle ---

  start() {
    if (this.status === 'running') {
      console.warn(`Engine ${this.index}: Already running.`);
      return;
    }

    this.status = 'starting';
    try {
      if (this.inputNode && this.inputNode.start) {
        this.inputNode.start();
      }
      this.status = 'running';
      console.log(`Engine ${this.index}: Started.`);
    } catch (err) {
      console.error(`Engine ${this.index}: Failed to start:`, err);
      this.status = 'error';
    }
  }

  stop() {
    if (this.status === 'stopped' || this.status === 'idle') {
      return;
    }

    this.status = 'stopped';
    try {
      if (this.inputNode) {
        if (this.inputNode.stop) {
          this.inputNode.stop();
        }
        this.inputNode.disconnect();
      }
      this.gainNode.disconnect();
      this.outputNode.disconnect();
      console.log(`Engine ${this.index}: Stopped and cleaned up.`);
    } catch (err) {
      console.error(`Engine ${this.index}: Error during cleanup:`, err);
    }
  }

  // --- Cleanup ---

  dispose() {
    this.stop();
    this.inputNode = null;
    this.gainNode = null;
    this.outputNode = null;
    console.log(`Engine ${this.index}: Disposed.`);
  }
}

/**
 * DSP Module — WASM with robust JS fallback
 * Handles noise generation and RMS calculations.
 */

const DSP_WASM_B64 = "AGFzbQEAAAABGQVgAXwBfGAAAX1gAX8AYAJ/fwBgAn9/AX0CCwEDZW52A2xvZwAAAwcGAQIDAwMEBQQBAQggBgkBfwFB5dCFKgsHPQYGbWVtb3J5AgAEc2VlZAACCWdlbl93aGl0ZQADCGdlbl9waW5rAAQJZ2VuX2Jyb3duAAUGcm1zX2RiAAYKmQQGOQEBfyMAIQAgACAAQQ10cyEAIAAgAEERdnMhACAAIABBBXRzIQAgACQAIACzQwAAADCUQwAAgD+TCwYAIAAkAAsrAQF/QQAhAgJAA0AgAiABTw0BIAAgAkEEbGoQATgCACACQQFqIQIMAAsLC9IBAgF/CX1BACECAkADQCACIAFPDQEQASEDIARDSrV/P5QgA0O9ZmM9lJIhBCAFQzhKfj+UIANDZcGZPZSSIQUgBkNiEHg/lCADQ2GLHT6UkiEGIAdD8tJdP5QgA0P4954+lJIhByAIQ83MDD+UIANDjm8IP5SSIQhDOPhCvyAJlCADQ61tijyUkyEJIAQgBZIgBpIgB5IgCJIgCZIgCpIgA0NnRAk/lJIhCyADQ5xq7T2UIQogACACQQRsaiALQ65H4T2UOAIAIAJBAWohAgwACwsgAyABuKMhBSAFnyEGIAZE8WjjiLX45D5lBH1DAACgwgVEAAAAAAAANEAgBhAARBZVtbuxawJAo6K2Cws=";

export const WASM_CONFIG = {
  BUFFER_SIZE: 2048,
  SAMPLE_RATE: 44100
};

let dsp = null;
let wasmReady = false;

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function loadDspModule() {
  if (wasmReady) return dsp;
  try {
    const bytes = b64ToBytes(DSP_WASM_B64);
    const { instance } = await WebAssembly.instantiate(bytes, {
      env: { log: Math.log }
    });
    if (!instance.exports || !instance.exports.memory) {
      throw new Error('WASM missing memory export');
    }
    dsp = instance.exports;
    wasmReady = true;
    console.log('WASM DSP loaded');
    return dsp;
  } catch (err) {
    console.warn('WASM unavailable, using JS fallback:', err.message);
    wasmReady = false;
    dsp = null;
    return null;
  }
}

export function getDspModule() {
  return dsp;
}

/* ───────── JS Noise Generators ───────── */

export function createNoiseBuffer(audioCtx, type) {
  if (dsp && dsp.memory && dsp.gen_white && dsp.gen_pink && dsp.gen_brown) {
    try {
      const len = Math.min(audioCtx.sampleRate * 2, 100000);
      const buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      dsp.seed((Date.now() ^ (Math.random() * 0xffffffff)) | 0);
      const off = 0;
      switch (type) {
        case 'white': dsp.gen_white(off, len); break;
        case 'pink':  dsp.gen_pink(off, len);  break;
        case 'brown': dsp.gen_brown(off, len); break;
        default:      dsp.gen_white(off, len);
      }
      const view = new Float32Array(dsp.memory.buffer, off, len);
      data.set(view);
      return buffer;
    } catch (e) {
      console.warn('WASM noise failed, falling back to JS');
    }
  }
  return createNoiseBufferJS(audioCtx, type);
}

function createNoiseBufferJS(audioCtx, type) {
  const len = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white' || !type) {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  else if (type === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const out = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      data[i] = out;
    }
  }
  else if (type === 'brown') {
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + white * 0.02) / 1.02;
      data[i] = lastOut * 3.5;
    }
  }
  return buffer;
}

/* ───────── JS RMS Calculator ───────── */

export function dbFromBuffer(floatData, wasmOffset = 0) {
  if (dsp && dsp.memory && dsp.rms_db) {
    try {
      const memLen = dsp.memory.buffer.byteLength;
      if (memLen < floatData.length * 4 + wasmOffset + 4) {
        throw new Error('WASM memory too small');
      }
      const view = new Float32Array(dsp.memory.buffer, wasmOffset, floatData.length);
      view.set(floatData);
      return dsp.rms_db(wasmOffset, floatData.length);
    } catch (e) {
      // fallthrough to JS
    }
  }
  return calculateRmsJs(floatData);
}

function calculateRmsJs(floatData) {
  let sum = 0;
  for (let i = 0; i < floatData.length; i++) sum += floatData[i] * floatData[i];
  const rms = Math.sqrt(sum / floatData.length);
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

export function dbToPct(db) {
  const clamped = Math.max(-60, Math.min(0, db));
  return ((clamped + 60) / 60) * 100;
}

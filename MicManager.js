/**
 * MicManager.js
 * Manages a single shared microphone stream for all engines.
 * Prevents redundant getUserMedia calls and permission prompts.
 */

let micStream = null;
let micSourceNode = null;
let audioCtx = null;

/**
 * Initialize the MicManager with an AudioContext.
 * @param {AudioContext} ctx - The AudioContext to use for creating the source node.
 */
export function initMicManager(ctx) {
  audioCtx = ctx;
}

/**
 * Get the shared microphone stream as a MediaStreamAudioSourceNode.
 * @returns {Promise<MediaStreamAudioSourceNode>}
 * @throws {Error} If mic access is denied.
 */
export async function getMicStream() {
  if (!audioCtx) {
    throw new Error('MicManager not initialized. Call initMicManager first.');
  }

  if (!micStream) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream = stream;
      micSourceNode = audioCtx.createMediaStreamSource(stream);
      console.log('Mic stream initialized.');
    } catch (err) {
      console.error('Mic access denied:', err);
      throw err;
    }
  }
  return micSourceNode;
}

/**
 * Release the microphone stream and clean up.
 */
export function releaseMicStream() {
  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
    micSourceNode = null;
    console.log('Mic stream released.');
  }
}

/**
 * Check if mic access is available.
 * @returns {Promise<boolean>}
 */
export async function isMicAvailable() {
  try {
    await getMicStream();
    return true;
  } catch {
    return false;
  }
}

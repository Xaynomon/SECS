import type { CircuitComponent } from '../types/circuit';

interface ActiveVoice {
  osc: OscillatorNode;
  gain: GainNode;
  lastFreq: number;
  lastGain: number;
}

let audioCtx: AudioContext | null = null;
const activeVoices = new Map<string, ActiveVoice>();
const overloadedNotifiedIds = new Set<string>();

let continuityVoice: { osc: OscillatorNode; gain: GainNode } | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtxCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxCtor) return null;
    try {
      audioCtx = new AudioCtxCtor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function stopVoice(compId: string): void {
  const voice = activeVoices.get(compId);
  if (!voice) return;
  activeVoices.delete(compId);
  try {
    const ctx = audioCtx;
    if (ctx) {
      const now = ctx.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0.0001, now, 0.015);
      voice.osc.stop(now + 0.05);
    } else {
      voice.osc.stop();
    }
  } catch {
    // Ignore already-stopped nodes
  }
}

function upsertVoice(
  ctx: AudioContext,
  compId: string,
  waveform: OscillatorType,
  freqHz: number,
  targetGain: number
): void {
  const clampedFreq = Math.max(40, Math.min(12000, freqHz));
  const clampedGain = Math.max(0.001, Math.min(0.18, targetGain));
  const now = ctx.currentTime;

  const existing = activeVoices.get(compId);
  if (existing) {
    if (existing.osc.type !== waveform) {
      existing.osc.type = waveform;
    }
    if (Math.abs(existing.lastFreq - clampedFreq) > 0.5) {
      existing.osc.frequency.setTargetAtTime(clampedFreq, now, 0.02);
      existing.lastFreq = clampedFreq;
    }
    if (Math.abs(existing.lastGain - clampedGain) > 0.002) {
      existing.gain.gain.setTargetAtTime(clampedGain, now, 0.02);
      existing.lastGain = clampedGain;
    }
    return;
  }

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = waveform;
    osc.frequency.setValueAtTime(clampedFreq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.setTargetAtTime(clampedGain, now, 0.015);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    activeVoices.set(compId, {
      osc,
      gain,
      lastFreq: clampedFreq,
      lastGain: clampedGain,
    });
  } catch {
    // Ignore audio context startup failures in restricted browsers
  }
}

function playBurnoutPop(ctx: AudioContext): void {
  try {
    const now = ctx.currentTime;

    // Low-frequency thump
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.11);
    oscGain.gain.setValueAtTime(0.12, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);

    // Brief crackle noise burst
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * 0.07));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.setValueAtTime(1.4, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.09, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.08);
  } catch {
    // Ignore audio errors
  }
}

/**
 * Synchronizes real-time WebAudio synthesizer output with the current simulated
 * circuit state (piezo buzzers, speakers, and one-shot overload burnout pops).
 */
export function syncCircuitSound(
  components: CircuitComponent[],
  isRunning: boolean,
  isSoundEnabled: boolean
): void {
  if (!isRunning || !isSoundEnabled) {
    for (const id of Array.from(activeVoices.keys())) {
      stopVoice(id);
    }
    if (!isRunning) {
      overloadedNotifiedIds.clear();
    }
    if (!isSoundEnabled) {
      setContinuityBeep(false, false);
    }
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  const nextActiveIds = new Set<string>();

  for (const comp of components) {
    const state = comp.state || {};
    const props = comp.properties || {};

    if (state.isOverloaded || state.isBurned) {
      if (!overloadedNotifiedIds.has(comp.id)) {
        overloadedNotifiedIds.add(comp.id);
        playBurnoutPop(ctx);
      }
      continue;
    } else {
      overloadedNotifiedIds.delete(comp.id);
    }

    if (comp.type === 'buzzer') {
      const voltageAbs = Math.abs(
        Number(state.voltageDropV ?? state.voltageDrop ?? state.voltage ?? state.pinVoltage ?? 0)
      );
      const currentAbs = Math.abs(Number(state.currentMa ?? 0));
      const explicitlyActive = Boolean(
        state.isSounding || state.sounding || state.isActive || state.active || state.isEnergized
      );
      const active = explicitlyActive || currentAbs >= 1.5 || voltageAbs >= 1.2;

      if (active) {
        nextActiveIds.add(comp.id);
        const freq = Number(
          state.audioFreqHz ||
            state.frequencyHz ||
            props.toneFrequency ||
            props.frequency ||
            props.frequencyHz ||
            2400
        );
        const level = Math.min(1, Math.max(0.25, voltageAbs / 5 || 0.6));
        upsertVoice(ctx, comp.id, 'square', freq, 0.045 * level);
      }
    } else if (comp.type === 'builtin_speaker') {
      if (props.audioEnabled === false) {
        continue;
      }
      const voltageAbs = Math.abs(
        Number(state.voltageDropV ?? state.voltageDrop ?? state.voltage ?? state.pinVoltage ?? 0)
      );
      const currentAbs = Math.abs(Number(state.currentMa ?? 0));
      const freqState = Number(state.audioFreqHz || state.frequencyHz || 0);
      const explicitlyActive = Boolean(
        state.isSounding ||
          state.sounding ||
          state.isActive ||
          state.active ||
          state.isEnergized ||
          freqState > 0
      );
      const active = explicitlyActive || currentAbs >= 2 || voltageAbs >= 0.8;

      if (active) {
        nextActiveIds.add(comp.id);
        const baseFreq =
          typeof props.toneFrequency === 'number'
            ? props.toneFrequency
            : Number(props.frequency || props.frequencyHz || 440);
        const vDrop = Math.abs(Number(state.voltageDropV ?? state.voltageDrop ?? 5.0));
        const freq =
          freqState > 0
            ? freqState
            : Math.max(80, Math.min(4000, baseFreq + (vDrop - 5.0) * 35));
        const level = Math.min(1, Math.max(0.25, voltageAbs / 5 || 0.7));
        upsertVoice(ctx, comp.id, 'triangle', freq, 0.075 * level);
      }
    }
  }

  for (const existingId of Array.from(activeVoices.keys())) {
    if (!nextActiveIds.has(existingId)) {
      stopVoice(existingId);
    }
  }
}

/**
 * Controls the continuous 2000 Hz multimeter continuity tester tone.
 */
export function setContinuityBeep(enabled: boolean, isSoundEnabled = true): void {
  const shouldPlay = enabled && isSoundEnabled;

  if (!shouldPlay) {
    if (!continuityVoice) return;
    const { osc, gain } = continuityVoice;
    continuityVoice = null;
    try {
      const ctx = audioCtx;
      if (ctx) {
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0.0001, now, 0.01);
        osc.stop(now + 0.04);
      } else {
        osc.stop();
      }
    } catch {
      // Ignore stop failures
    }
    return;
  }

  if (continuityVoice) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.setTargetAtTime(0.05, now, 0.01);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    continuityVoice = { osc, gain };
  } catch {
    // Ignore browser audio gesture blocks
  }
}

/**
 * Immediately stops all active circuit component voices, continuity tones, and burnout tracking.
 */
export function stopAllSounds(): void {
  for (const id of Array.from(activeVoices.keys())) {
    stopVoice(id);
  }
  overloadedNotifiedIds.clear();
  setContinuityBeep(false, false);
}

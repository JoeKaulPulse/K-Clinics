'use client';

// A soft synthesized "mumble" under the K while it speaks — a gentle blip per few
// characters (Animal-Crossing style), built with Web Audio so there are no audio
// files. Mutable and persisted; the app reads/writes a single flag.

const KEY = 'kacademy_voice_muted';
let ctx: AudioContext | null = null;
let muted = false;
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try { muted = typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1'; } catch { /* */ }
}

export function isMascotMuted(): boolean { load(); return muted; }

export function setMascotMuted(m: boolean): void {
  load(); muted = m;
  try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* */ }
}

/** Play one short, soft blip — call a few times across a spoken line. No-op when
 *  muted or before a user gesture has unlocked audio. */
export function mascotBlip(mood: 'happy' | 'think' | 'cheer' = 'happy'): void {
  load();
  if (muted || typeof window === 'undefined') return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    const centre = mood === 'cheer' ? 300 : mood === 'think' ? 190 : 240;
    o.frequency.value = centre + (Math.random() - 0.5) * 70;
    o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
    o.start(t);
    o.stop(t + 0.1);
  } catch { /* audio not available */ }
}

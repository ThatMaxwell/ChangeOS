// ChangeOS UI sounds, synthesized with Web Audio (no audio files). Off until the visitor interacts.
let ctx = null, master = null, enabled = false;
const KEY = "changeos-sound";

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export const sound = {
  get on() { return enabled; },
  preference() { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v) {
    enabled = v;
    try { localStorage.setItem(KEY, v ? "on" : "off"); } catch {}
    if (v) ensure();
    document.dispatchEvent(new CustomEvent("sound:change", { detail: v }));
  },
};

function tone(freq, { at = 0, dur = 0.12, type = "sine", gain = 0.2, attack = 0.005, slideTo = null } = {}) {
  if (!enabled || !ensure()) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise({ at = 0, dur = 0.35, from = 400, to = 3000, gain = 0.12, q = 1.2 } = {}) {
  if (!enabled || !ensure()) return;
  const t = ctx.currentTime + at;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = q;
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  tick: () => tone(1800, { dur: 0.04, type: "triangle", gain: 0.08 }),
  tap: () => { tone(660, { dur: 0.07, type: "sine", gain: 0.14 }); tone(1320, { at: 0.01, dur: 0.05, gain: 0.05 }); },
  key: () => tone(2400 + Math.random() * 600, { dur: 0.018, type: "square", gain: 0.025 }),
  enter: () => tone(880, { dur: 0.06, type: "triangle", gain: 0.1 }),
  whoosh: () => noise({ dur: 0.42, from: 300, to: 2600, gain: 0.07 }),
  error: () => { tone(160, { dur: 0.16, type: "sawtooth", gain: 0.08 }); tone(120, { at: 0.12, dur: 0.2, type: "sawtooth", gain: 0.08 }); },
  power: () => { tone(90, { dur: 0.5, type: "sine", gain: 0.3, slideTo: 45 }); noise({ dur: 0.25, from: 2000, to: 500, gain: 0.04 }); },
  // ring draws, dots pop, bullseye lands
  sweep: () => noise({ dur: 0.9, from: 250, to: 4000, gain: 0.05, q: 2 }),
  dot: (i) => tone([784, 988, 1175, 1568][i % 4], { dur: 0.09, type: "sine", gain: 0.1 }),
  chime: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { at: i * 0.09, dur: 1.2 - i * 0.15, type: "sine", gain: 0.12 }));
    tone(2093, { at: 0.36, dur: 0.9, type: "sine", gain: 0.04 });
  },
  thump: () => { tone(110, { dur: 0.25, type: "sine", gain: 0.3, slideTo: 60 }); tone(1760, { dur: 0.05, type: "triangle", gain: 0.05 }); },
  dive: () => noise({ dur: 0.85, from: 4000, to: 150, gain: 0.08, q: 0.8 }),
};

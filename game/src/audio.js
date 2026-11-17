// Sound made from oscillators and filtered noise, no audio files: an engine hum whose
// pitch follows speed, two-tone sirens, gunshots, crashes, phone blips and cash chimes.
// Everything is created lazily on the first user gesture, as browsers require.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenFlip = null;
  let muted = false;

  /** Build the context and the looping engine/siren voices. Safe to call every frame. */
  function ensure() {
    if (ctx !== null) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC === undefined) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();

    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
    let high = false;
    sirenFlip = window.setInterval(() => {
      if (ctx === null) return;
      high = !high;
      sirenOsc.frequency.setValueAtTime(high ? 950 : 680, ctx.currentTime);
    }, 420);
  }

  /** A short noise burst through a band filter: gunshots, crashes, punches of static. */
  function noiseBurst(duration, filterFreq, gainValue, type = 'bandpass') {
    if (ctx === null) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    source.connect(filter).connect(gain).connect(master);
    source.start();
  }

  /** A clean sine blip at a pitch, for phone messages and menu moves. */
  function blip(freq, duration = 0.09, gainValue = 0.16, when = 0) {
    if (ctx === null) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const start = ctx.currentTime + when;
    gain.gain.setValueAtTime(gainValue, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  return {
    /** Call from any click or key press so the browser lets sound start. */
    unlock() {
      ensure();
    },
    /** Flip the mute switch; returns the new state. */
    toggleMute() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** Engine voice: `amount` 0..1 of the car's top speed, 0 when on foot. */
    engine(amount) {
      if (ctx === null) return;
      const target = amount > 0.01 ? 0.05 + amount * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + amount * 165, ctx.currentTime, 0.06);
    },
    /** Siren voice: louder the nearer the nearest police car, 0 when none is close. */
    siren(amount) {
      if (ctx === null) return;
      sirenGain.gain.setTargetAtTime(amount * 0.045, ctx.currentTime, 0.15);
    },
    gunshot() {
      noiseBurst(0.11, 1800, 0.5);
    },
    distantShot() {
      noiseBurst(0.09, 900, 0.18);
    },
    crash(strength) {
      noiseBurst(0.22, 300, Math.min(0.7, 0.2 + strength * 0.5), 'lowpass');
    },
    skid() {
      noiseBurst(0.16, 2600, 0.06);
    },
    phone() {
      blip(880, 0.08, 0.14);
      blip(1174, 0.1, 0.14, 0.1);
    },
    cash() {
      blip(1318, 0.07, 0.15);
      blip(1568, 0.09, 0.15, 0.07);
      blip(2093, 0.14, 0.15, 0.14);
    },
    hurt() {
      blip(160, 0.16, 0.25);
    },
    missionDone() {
      blip(784, 0.1, 0.16);
      blip(988, 0.1, 0.16, 0.1);
      blip(1175, 0.18, 0.16, 0.2);
    },
  };
}

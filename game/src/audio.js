// All sound is synthesized with the Web Audio API: no audio files, no network.
// The game stays silent until the player first presses a key or clicks, which
// is also what unlocks the browser's audio context.
export function createSoundBank() {
  let context = null;
  let master = null;
  let alarmOscillator = null;
  let alarmGain = null;

  function ensureContext() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function unlockAudio() {
    if (ensureContext() && context.state === 'suspended') context.resume();
  }

  function playTone(frequency, durationSeconds, type, volume, slideTo) {
    if (!ensureContext()) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + durationSeconds);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + durationSeconds);
  }

  function playLootChime() {
    playTone(880, 0.12, 'sine', 0.5);
    setTimeout(() => playTone(1318, 0.18, 'sine', 0.45), 90);
  }

  function playFootstep() {
    playTone(140, 0.05, 'triangle', 0.12, 90);
  }

  function playSmokePuff() {
    playTone(320, 0.4, 'sawtooth', 0.2, 70);
  }

  function playCaughtSting() {
    playTone(220, 0.5, 'sawtooth', 0.5, 55);
    setTimeout(() => playTone(110, 0.7, 'sawtooth', 0.5, 40), 120);
  }

  function playEscapeFanfare() {
    [523, 659, 784, 1046].forEach((frequency, index) => {
      setTimeout(() => playTone(frequency, 0.22, 'triangle', 0.45), index * 110);
    });
  }

  function startAlarmHum() {
    if (!ensureContext() || alarmOscillator) return;
    alarmOscillator = context.createOscillator();
    alarmGain = context.createGain();
    alarmOscillator.type = 'square';
    alarmOscillator.frequency.value = 620;
    alarmGain.gain.value = 0.0;
    alarmOscillator.connect(alarmGain);
    alarmGain.connect(master);
    alarmOscillator.start();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.frequency.value = 2.2;
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(alarmGain.gain);
    lfo.start();
    alarmOscillator._lfo = lfo;
  }

  function setAlarmLevel(levelZeroToOne) {
    if (alarmGain) alarmGain.gain.value = 0.02 + levelZeroToOne * 0.06;
  }

  function stopAlarmHum() {
    if (!alarmOscillator) return;
    try {
      alarmOscillator._lfo.stop();
      alarmOscillator.stop();
    } catch {
      // Already stopped.
    }
    alarmOscillator = null;
    alarmGain = null;
  }

  return {
    unlockAudio,
    playLootChime,
    playFootstep,
    playSmokePuff,
    playCaughtSting,
    playEscapeFanfare,
    startAlarmHum,
    setAlarmLevel,
    stopAlarmHum,
  };
}

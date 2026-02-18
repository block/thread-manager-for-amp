let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function playNotificationSound(): void {
  try {
    const ctx = getAudioContext();

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;

    // Create oscillator for the "boop" tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Soft, pleasant frequency (G5 note ~ 784 Hz, then slide down)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(784, now);
    osc.frequency.exponentialRampToValueAtTime(523, now + 0.15); // Slide to C5

    // Quick fade in/out for a gentle sound
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02); // Quick attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2); // Decay

    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // Silently fail if audio isn't available
  }
}

// Settings key for localStorage
const SOUND_ENABLED_KEY = 'amp-notification-sound-enabled';

export function isSoundEnabled(): boolean {
  const stored = localStorage.getItem(SOUND_ENABLED_KEY);
  return stored !== 'false'; // Default to enabled
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
}

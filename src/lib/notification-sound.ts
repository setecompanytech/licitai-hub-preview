// Web Audio API notification sound — no external files needed
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function playNotificationSound(type: 'message' | 'alert' | 'success' = 'message') {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    if (type === 'alert') {
      // Two-tone alert
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      oscillator.type = 'sine';
    } else if (type === 'success') {
      // Rising chime
      oscillator.frequency.setValueAtTime(523, ctx.currentTime);
      oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(1047, ctx.currentTime + 0.2);
      oscillator.type = 'sine';
    } else {
      // Simple soft ping
      oscillator.frequency.setValueAtTime(660, ctx.currentTime);
      oscillator.type = 'sine';
    }

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  } catch {
    // Silently fail if audio is not available
  }
}

// Sound preference storage
const SOUND_KEY = 'licitia_sound_enabled';

export function isSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_KEY) !== 'false';
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_KEY, String(enabled));
}

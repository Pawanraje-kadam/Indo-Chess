/** Chess sound effects using Web Audio API - No external dependencies */

class ChessSounds {
  private audioContext: AudioContext | null = null;
  private enabled = true;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', gain = 0.3) {
    if (!this.enabled) return;
    
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = type;
      
      gainNode.gain.setValueAtTime(gain, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio not supported
    }
  }

  private playNoise(duration: number, gain = 0.1) {
    if (!this.enabled) return;
    
    try {
      const ctx = this.getContext();
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      noise.buffer = buffer;
      filter.type = 'lowpass';
      filter.frequency.value = 1000;
      
      noise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      gainNode.gain.setValueAtTime(gain, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      noise.start(ctx.currentTime);
    } catch (e) {
      // Audio not supported
    }
  }

  move() {
    // Wood-like click sound
    this.playTone(800, 0.05, 'square', 0.15);
    setTimeout(() => this.playTone(400, 0.08, 'sine', 0.1), 20);
  }

  capture() {
    // Heavier impact sound
    this.playNoise(0.1, 0.15);
    this.playTone(200, 0.15, 'sine', 0.2);
    setTimeout(() => this.playTone(150, 0.1, 'sine', 0.15), 30);
  }

  check() {
    // Alert tone
    this.playTone(880, 0.1, 'sine', 0.2);
    setTimeout(() => this.playTone(1100, 0.15, 'sine', 0.15), 100);
  }

  castle() {
    // Double click for castle
    this.move();
    setTimeout(() => this.move(), 100);
  }

  promotion() {
    // Rising tone
    this.playTone(440, 0.1, 'sine', 0.15);
    setTimeout(() => this.playTone(660, 0.1, 'sine', 0.15), 80);
    setTimeout(() => this.playTone(880, 0.15, 'sine', 0.2), 160);
  }

  gameEnd() {
    // Fanfare
    this.playTone(523, 0.15, 'sine', 0.2);
    setTimeout(() => this.playTone(659, 0.15, 'sine', 0.2), 150);
    setTimeout(() => this.playTone(784, 0.3, 'sine', 0.25), 300);
  }

  illegal() {
    // Error buzz
    this.playTone(150, 0.15, 'square', 0.1);
  }

  gameStart() {
    // Ready tone
    this.playTone(440, 0.1, 'sine', 0.1);
    setTimeout(() => this.playTone(554, 0.1, 'sine', 0.12), 100);
    setTimeout(() => this.playTone(659, 0.15, 'sine', 0.15), 200);
  }

  toggle(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled() {
    return this.enabled;
  }
}

export const sounds = new ChessSounds();

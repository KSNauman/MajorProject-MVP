/**
 * EduVision Procedural Web Audio Engine
 * Recreates the procedural synthesis from the Pygame audio mixers.
 * Fully guarded with try/catch so audio issues can never crash game logic.
 */
class EngineAudio {
    constructor() {
        this.ctx = null;
        this.muted = false;
    }

    init() {
        try {
            if (!this.ctx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    this.ctx = new AudioContext();
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
        } catch (e) {
            console.warn('[EngineAudio] AudioContext init warning:', e);
        }
    }

    playSine(freq, duration = 0.15, maxGain = 0.15) {
        if (this.muted) return;
        try {
            this.init();
            if (!this.ctx) return;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(maxGain, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            console.warn('[EngineAudio] playSine error:', e);
        }
    }

    playPickup() {
        this.playSine(587.33, 0.08, 0.12); // D5
    }

    playSnap() {
        this.playSine(783.99, 0.12, 0.15); // G5
    }

    playSoftBounce() {
        if (this.muted) return;
        try {
            this.init();
            if (!this.ctx) return;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(250, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.2);

            gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.2);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.2);
        } catch (e) {
            console.warn('[EngineAudio] playSoftBounce error:', e);
        }
    }

    playWhoosh() {
        if (this.muted) return;
        try {
            this.init();
            if (!this.ctx) return;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, this.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(450, this.ctx.currentTime + 0.12);
            osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.25);

            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.25);
        } catch (e) {
            console.warn('[EngineAudio] playWhoosh error:', e);
        }
    }

    playSuccess() {
        if (this.muted) return;
        try {
            this.init();
            if (!this.ctx) return;

            // Major Triad Arpeggio (C5 -> E5 -> G5 -> C6)
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, i) => {
                setTimeout(() => {
                    this.playSine(freq, 0.22, 0.12);
                }, i * 70);
            });
        } catch (e) {
            console.warn('[EngineAudio] playSuccess error:', e);
        }
    }

    playFanfare() {
        if (this.muted) return;
        try {
            this.init();
            if (!this.ctx) return;

            const chord = [523.25, 659.25, 783.99, 1046.50];
            chord.forEach(freq => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

                gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start();
                osc.stop(this.ctx.currentTime + 0.8);
            });
        } catch (e) {
            console.warn('[EngineAudio] playFanfare error:', e);
        }
    }

    playWinChord() {
        this.playFanfare();
    }
}

window.soundEngine = new EngineAudio();

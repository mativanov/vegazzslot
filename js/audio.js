/**
 * audio.js — Classic casino synthesized sound engine
 * Neon Reels — Underground Casino
 *
 * Design philosophy: warm, inviting, Vegas-style.
 * - Spin: rapid mechanical "tick-tick-tick" of symbols passing,
 *         slowing down naturally as each reel decelerates — no hum, no jet engine.
 * - Stop: satisfying weighted "clunk" per reel, slightly pitched per column.
 * - Win:  bright, musical, classic fruit-machine chime cascade.
 * - Big win / Bonus: full orchestral fanfare with bell tones and coin sparkle.
 *
 * All sounds synthesized via Web Audio API — zero external files.
 * AudioContext created lazily on first user gesture (browser autoplay policy).
 */

'use strict';

const Audio = (() => {

  /** @type {AudioContext|null} */
  let ctx         = null;
  let masterGain  = null;

  // Active tick node so we can cancel it cleanly on early stop
  let tickIntervalId = null;

  // ── Context bootstrap ──────────────────────────────────────

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.6;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ── Low-level synthesis primitives ────────────────────────

  /**
   * Schedule a tone with a full ADSR envelope.
   * @param {number} freq
   * @param {number} startTime   AudioContext time
   * @param {number} duration    Seconds (attack → release end)
   * @param {string} [type]      OscillatorType
   * @param {number} [peakGain]  0–1
   * @param {{ attack, decay, sustain, release }} [env]
   */
  function tone(freq, startTime, duration, type = 'sine', peakGain = 0.4, env = {}) {
    const c   = getCtx();
    const osc = c.createOscillator();
    const g   = c.createGain();

    const {
      attack  = 0.005,
      decay   = 0.06,
      sustain = 0.75,
      release = 0.12,
    } = env;

    const sustainGain = peakGain * sustain;
    const releaseStart = Math.max(startTime + attack + decay, startTime + duration - release);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(peakGain,    startTime + attack);
    g.gain.linearRampToValueAtTime(sustainGain, startTime + attack + decay);
    g.gain.setValueAtTime(sustainGain,          releaseStart);
    g.gain.linearRampToValueAtTime(0,           releaseStart + release);

    osc.connect(g);
    g.connect(masterGain);
    osc.start(startTime);
    osc.stop(releaseStart + release + 0.01);
  }

  /**
   * A single sharp mechanical "tick" — the building block of spin audio.
   * Layered: short sine body + filtered noise transient for realism.
   * @param {number} startTime
   * @param {number} pitchHz     Fundamental frequency (higher = lighter tick)
   * @param {number} gainScale   0–1 volume scaling
   */
  function tick(startTime, pitchHz = 320, gainScale = 1.0) {
    const c = getCtx();

    // Body — short sine with fast decay
    tone(pitchHz, startTime, 0.055, 'sine', 0.28 * gainScale, {
      attack: 0.001, decay: 0.025, sustain: 0.2, release: 0.02,
    });

    // Sub thump for weight
    tone(pitchHz * 0.5, startTime, 0.04, 'triangle', 0.18 * gainScale, {
      attack: 0.001, decay: 0.02, sustain: 0.1, release: 0.015,
    });

    // Click transient via bandpass noise burst
    const bufLen = Math.ceil(c.sampleRate * 0.018);
    const buf    = c.createBuffer(1, bufLen, c.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);

    const src    = c.createBufferSource();
    src.buffer   = buf;

    const bp     = c.createBiquadFilter();
    bp.type      = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value         = 1.2;

    const ng     = c.createGain();
    ng.gain.setValueAtTime(0.22 * gainScale, startTime);
    ng.gain.linearRampToValueAtTime(0, startTime + 0.018);

    src.connect(bp);
    bp.connect(ng);
    ng.connect(masterGain);
    src.start(startTime);
    src.stop(startTime + 0.02);
  }

  /**
   * Schedule a decelerating tick stream — mimics a reel slowing to a stop.
   *
   * Starts at `fastBPM` ticks/sec, exponentially decelerates to `slowBPM`,
   * then stops. Each tick's pitch slightly descends as the reel slows.
   *
   * @param {number} startTime       AudioContext time to begin
   * @param {number} streamDuration  How long the deceleration lasts (seconds)
   * @param {number} fastBPM         Starting speed (ticks per second)
   * @param {number} slowBPM         Ending speed (ticks per second)
   * @param {number} basePitch       Starting tick pitch Hz
   */
  function deceleratingTicks(startTime, streamDuration, fastBPM, slowBPM, basePitch) {
    // Build a time array by integrating the exponential deceleration curve
    const times = [];
    let t = 0;
    while (t < streamDuration) {
      times.push(t);
      const progress  = t / streamDuration;                            // 0 → 1
      const currentHz = fastBPM * Math.pow(slowBPM / fastBPM, progress); // exp interp
      const interval  = 1 / currentHz;
      t += interval;
    }

    times.forEach((offset, idx) => {
      const progress   = offset / streamDuration;
      const pitchShift = 1 - progress * 0.25;                  // pitch drops 25% as it slows
      const gainShift  = 0.6 + 0.4 * (1 - progress);           // slightly louder when fast
      tick(startTime + offset, basePitch * pitchShift, gainShift);
    });
  }

  // ── Public API ─────────────────────────────────────────────

  return {

    /** Resume AudioContext after the first user gesture */
    unlock() { getCtx(); },

    // ── Coin insert ────────────────────────────────────────

    /**
     * Classic coin drop jingle: metallic clink + ascending arpeggio.
     * Think: Vegas machine accepting a quarter.
     */
    playCash() {
      const c   = getCtx();
      const now = c.currentTime;

      // Metallic coin clink — high sine ping with fast decay
      [1046, 1318, 1046].forEach((f, i) => {
        tone(f, now + i * 0.07, 0.18, 'sine', 0.35, {
          attack: 0.002, decay: 0.04, sustain: 0.3, release: 0.1,
        });
      });

      // Warm arpeggio: C major triad ascending
      [523, 659, 784, 1046].forEach((f, i) => {
        tone(f, now + 0.22 + i * 0.10, 0.22, 'triangle', 0.3, {
          attack: 0.008, decay: 0.05, sustain: 0.6, release: 0.12,
        });
      });
    },

    // ── Reel spin ──────────────────────────────────────────

    /**
     * The signature sound: each reel ticks rapidly then decelerates.
     * Columns stagger their start and duration, so you hear them
     * individually winding down — exactly like a real machine.
     *
     * @param {number} totalDuration  Full spin duration (last reel settles at this time)
     */
    playSpin(totalDuration) {
      const c   = getCtx();
      const now = c.currentTime;

      // Per-column parameters — each reel runs slightly longer
      const colCount = 5;
      const basePitches = [340, 310, 280, 255, 235]; // each column slightly deeper

      for (let i = 0; i < colCount; i++) {
        // Column i stops at: SPIN_DURATION_BASE + i * SPIN_DURATION_STEP
        // (mirrors Config.REEL.SPIN_DURATION_BASE/STEP)
        const colStopTime  = 1.0 + i * 0.5;
        const streamStart  = now + i * 0.06;          // tiny stagger on launch

        // Full-speed section: from launch until ~0.5s before stop
        const fastDuration = Math.max(colStopTime - 0.55, 0.1);
        // Deceleration section: final 0.55s
        const decelStart   = now + fastDuration;
        const decelDur     = colStopTime - fastDuration;

        // Fast constant ticking (18 ticks/sec = smooth scroll feeling)
        const fastInterval = 1 / 18;
        for (let t = 0; t < fastDuration; t += fastInterval) {
          tick(streamStart + t, basePitches[i], 0.55);
        }

        // Decelerating section: 18 → 3 ticks/sec
        deceleratingTicks(decelStart, decelDur, 18, 3, basePitches[i]);
      }
    },

    // ── Reel stop ──────────────────────────────────────────

    /**
     * Satisfying weighted "clunk" as each reel locks into place.
     * Two-layer: low thud (mechanical stop) + brief rattle.
     * @param {number} columnIndex  0–4
     */
    playReelStop(columnIndex) {
      const c   = getCtx();
      const now = c.currentTime;

      // Fundamental drop — lower for later columns (they feel heavier)
      const freq = 200 - columnIndex * 18;

      // Main clunk — short sine with fast attack
      tone(freq, now, 0.14, 'sine', 0.55, {
        attack: 0.001, decay: 0.04, sustain: 0.15, release: 0.08,
      });

      // Sub body
      tone(freq * 0.55, now, 0.12, 'triangle', 0.35, {
        attack: 0.001, decay: 0.03, sustain: 0.1, release: 0.07,
      });

      // Brief mechanical rattle — 3 rapid ticks right after the stop
      [0.03, 0.06, 0.09].forEach((offset, k) => {
        tick(now + offset, freq * 1.8, 0.25 - k * 0.07);
      });
    },

    // ── Small win ──────────────────────────────────────────

    /**
     * Classic fruit-machine win chime: bright bell cascade.
     * C major pentatonic, triangle wave for that warm 70s feel.
     */
    playWin() {
      const c   = getCtx();
      const now = c.currentTime;

      // Bell tones
      const notes = [784, 988, 1175, 1568, 1976]; // G5 B5 D6 G6 B6
      notes.forEach((f, i) => {
        tone(f, now + i * 0.075, 0.35, 'triangle', 0.32, {
          attack: 0.005, decay: 0.08, sustain: 0.5, release: 0.18,
        });
        // Octave shimmer
        tone(f * 2, now + i * 0.075 + 0.01, 0.18, 'sine', 0.10, {
          attack: 0.003, decay: 0.04, sustain: 0.2, release: 0.1,
        });
      });
    },

    // ── Big win / Jackpot ──────────────────────────────────

    /**
     * Full fanfare: drum roll feel → chord stab → ascending bell shower.
     * Layered to feel genuinely exciting without being cheap.
     */
    playBigWin() {
      const c   = getCtx();
      const now = c.currentTime;

      // Rapid ascending tick drum roll (0 → 0.4s)
      for (let i = 0; i < 14; i++) {
        const t = now + i * (0.4 / 14);
        tick(t, 260 + i * 12, 0.4 + i * 0.04);
      }

      // Big chord stab at 0.42s — C major 7 with full voicing
      const chordTime = now + 0.42;
      [262, 330, 392, 494, 659, 784].forEach(f => {
        tone(f, chordTime, 1.0, 'triangle', 0.28, {
          attack: 0.012, decay: 0.10, sustain: 0.7, release: 0.4,
        });
        // Sine layer for shimmer
        tone(f, chordTime + 0.01, 0.8, 'sine', 0.16, {
          attack: 0.015, decay: 0.08, sustain: 0.65, release: 0.35,
        });
      });

      // Rising bell cascade after the chord (0.55s → 1.4s)
      const cascade = [523, 659, 784, 1046, 1319, 1568, 2093, 2637];
      cascade.forEach((f, i) => {
        const t = chordTime + 0.13 + i * 0.10;
        tone(f, t, 0.4, 'triangle', 0.26 - i * 0.02, {
          attack: 0.004, decay: 0.06, sustain: 0.45, release: 0.2,
        });
      });

      // Final high sparkle ping
      tone(3136, chordTime + 1.05, 0.35, 'sine', 0.18, {
        attack: 0.002, decay: 0.04, sustain: 0.3, release: 0.2,
      });
    },

    // ── Bonus trigger ──────────────────────────────────────

    /**
     * Magical ascending scale — clearly distinct from the win sound.
     * Uses sine + triangle blend for a warm, glittery feel.
     */
    playBonusTrigger() {
      const c   = getCtx();
      const now = c.currentTime;

      // Whole-tone scale — sounds otherworldly / bonus-y
      const scale = [523, 659, 784, 932, 1109, 1319, 1568, 1865];
      scale.forEach((f, i) => {
        const t = now + i * 0.095;
        tone(f, t, 0.30, 'triangle', 0.30, {
          attack: 0.006, decay: 0.06, sustain: 0.65, release: 0.16,
        });
        tone(f * 2, t + 0.02, 0.18, 'sine', 0.12, {
          attack: 0.004, decay: 0.04, sustain: 0.3, release: 0.1,
        });
      });

      // Twinkle at the top
      [2637, 3136, 2637].forEach((f, i) => {
        tone(f, now + 0.85 + i * 0.08, 0.22, 'sine', 0.18, {
          attack: 0.003, decay: 0.03, sustain: 0.35, release: 0.12,
        });
      });
    },

    // ── Scatter ping ───────────────────────────────────────

    /**
     * Two-note "ding-ding" — alerts the player a scatter landed.
     * Distinct enough to stand out mid-spin without being jarring.
     */
    playScatter() {
      const c   = getCtx();
      const now = c.currentTime;
      tone(1319, now,        0.20, 'triangle', 0.35, { attack: 0.004, decay: 0.05, sustain: 0.5, release: 0.10 });
      tone(1760, now + 0.13, 0.18, 'triangle', 0.30, { attack: 0.004, decay: 0.05, sustain: 0.45, release: 0.10 });
    },

    // ── Error ──────────────────────────────────────────────

    /**
     * Two descending tones — "no, you can't do that".
     * Soft enough not to be alarming.
     */
    playError() {
      const c   = getCtx();
      const now = c.currentTime;
      tone(392, now,        0.16, 'triangle', 0.28, { attack: 0.005, decay: 0.05, sustain: 0.4, release: 0.09 });
      tone(294, now + 0.14, 0.14, 'triangle', 0.22, { attack: 0.005, decay: 0.04, sustain: 0.35, release: 0.08 });
    },

    // ── UI click ───────────────────────────────────────────

    /**
     * Soft button click — just a tick at neutral pitch.
     */
    playClick() {
      tick(getCtx().currentTime, 600, 0.5);
    },

  };

})();
/**
 * config.js - Game constants and symbol definitions
 * Vegazz Slot
 */

'use strict';

const Config = Object.freeze({
  GAME: Object.freeze({
    NAME: 'Vegazz Slot',
    TARGET_RTP: 95.8,
    HIT_RATE: 26.8,
    BONUS_RATE_LABEL: '~1 / 100',
    VOLATILITY: 'Medium',
    MIN_SPIN_SECONDS: 2.5,
  }),

  REEL: Object.freeze({
    COLUMNS: 5,
    VISIBLE_ROWS: 3,
    CELL_PX: 130,
    SPIN_DEPTH: [10, 20, 30, 40, 50],
    SPIN_DURATION_BASE: 1.0,
    SPIN_DURATION_STEP: 0.5,
  }),

  BET: Object.freeze({
    VALUES: [1, 5, 10, 25, 50, 100],
    DEFAULT: 1,
    DEPOSIT_AMOUNT: 1000,
    DEPOSIT_TOP_UP: 500,
  }),

  BONUS: Object.freeze({
    SCATTER_TRIGGER_COUNT: 3,
    FREE_SPINS_AWARDED: 6,
    WIN_MULTIPLIER: 1,
  }),

  PAYOUTS: Object.freeze({
    LINE_1: Object.freeze({ 2: 0.5, 3: 2.35, 4: 16, 5: 105 }),
    LINE_2: Object.freeze({ 2: 0, 3: 1.2, 4: 9, 5: 55 }),
    LINE_3: Object.freeze({ 2: 0, 3: 1.2, 4: 9, 5: 55 }),
  }),

  WIN_TIER: Object.freeze({
    JACKPOT: 60,
    BIG: 12,
    MEDIUM: 2,
  }),

  SYMBOLS: Object.freeze([
    { id: 0, code: 'cherry', glyph: '🍒', label: 'Cherry', type: 'regular', weight: 18 },
    { id: 1, code: 'lemon', glyph: '🍋', label: 'Lemon', type: 'regular', weight: 16 },
    { id: 2, code: 'orange', glyph: '🍊', label: 'Orange', type: 'regular', weight: 14 },
    { id: 3, code: 'plum', glyph: '🍇', label: 'Plum', type: 'regular', weight: 12 },
    { id: 4, code: 'melon', glyph: '🍉', label: 'Melon', type: 'regular', weight: 10 },
    { id: 5, code: 'bell', glyph: '🔔', label: 'Bell', type: 'regular', weight: 8 },
    { id: 6, code: 'bar', glyph: 'BAR', label: 'Bar', type: 'regular', weight: 6 },
    { id: 7, code: 'seven', glyph: '7', label: 'Seven', type: 'regular', weight: 4 },
    { id: 8, code: 'wild', glyph: '◆', label: 'Wild', type: 'wild', weight: 5 },
    { id: 9, code: 'scatter', glyph: '✦', label: 'Scatter', type: 'scatter', weight: 3 },
  ]),
});

const SymbolPicker = (() => {
  const pool = [];
  Config.SYMBOLS.forEach(sym => {
    for (let i = 0; i < sym.weight; i++) pool.push(sym.id);
  });

  return {
    random() {
      return pool[Math.floor(Math.random() * pool.length)];
    },
    get(id) {
      return Config.SYMBOLS[id];
    },
  };
})();

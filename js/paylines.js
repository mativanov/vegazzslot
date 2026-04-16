/**
 * paylines.js - Win detection, wild substitution, payout calculation
 * Vegazz Slot
 */

'use strict';

const Paylines = (() => {
  const WILD_ID = Config.SYMBOLS.find(s => s.type === 'wild').id;
  const SCATTER_ID = Config.SYMBOLS.find(s => s.type === 'scatter').id;

  const ROW_PAYOUT_MAP = [
    Config.PAYOUTS.LINE_2,
    Config.PAYOUTS.LINE_1,
    Config.PAYOUTS.LINE_3,
  ];

  const ROW_CLASSES = ['payline-bar--2', 'payline-bar--1', 'payline-bar--3'];
  const ROW_NAMES = ['Line 2', 'Line 1', 'Line 3'];

  function resolveRow(row) {
    const scatterPositions = new Set();
    row.forEach((id, i) => {
      if (id === SCATTER_ID) scatterPositions.add(i);
    });

    const freq = new Map();
    row.forEach(id => {
      if (id !== WILD_ID && id !== SCATTER_ID) {
        freq.set(id, (freq.get(id) || 0) + 1);
      }
    });

    let dominant = -1;
    let maxFreq = 0;
    freq.forEach((count, id) => {
      if (count > maxFreq) {
        maxFreq = count;
        dominant = id;
      }
    });

    const resolved = [...row];
    const wildPositions = new Set();
    row.forEach((id, i) => {
      if (id === WILD_ID && dominant !== -1) {
        resolved[i] = dominant;
        wildPositions.add(i);
      }
    });

    return { resolved, wildPositions, scatterPositions };
  }

  function countMatch(row) {
    if (row.length === 0) return { symbol: -1, count: 0 };
    const first = row[0];
    if (first === SCATTER_ID) return { symbol: -1, count: 0 };

    let count = 1;
    for (let i = 1; i < row.length; i++) {
      if (row[i] === first) count++;
      else break;
    }

    return { symbol: first, count };
  }

  return {
    evaluate(grid, bet, bonusMultiplier = 1) {
      const lineWins = [];
      let totalPayout = 0;
      let scatterCount = 0;
      const scatterCols = new Set();

      grid.forEach((row, rowIndex) => {
        const { resolved, wildPositions, scatterPositions } = resolveRow(row);

        scatterPositions.forEach(col => scatterCols.add(col));
        scatterCount += scatterPositions.size;

        const { symbol, count } = countMatch(resolved);
        const minMatch = rowIndex === 1 ? 2 : 3;
        if (count < minMatch || symbol === -1) return;

        const payoutTable = ROW_PAYOUT_MAP[rowIndex];
        const multiplier = payoutTable[count] || 0;
        if (multiplier === 0) return;

        const payout = Number((multiplier * bet * bonusMultiplier).toFixed(2));
        totalPayout = Number((totalPayout + payout).toFixed(2));

        lineWins.push({
          row,
          rowIndex,
          name: ROW_NAMES[rowIndex],
          paylineClass: ROW_CLASSES[rowIndex],
          symbol,
          count,
          payout,
          wildPositions,
        });
      });

      return {
        lineWins,
        scatterCount,
        scatterCols: [...scatterCols],
        totalPayout,
        hasWin: totalPayout > 0,
      };
    },

    WILD_ID,
    SCATTER_ID,
  };
})();

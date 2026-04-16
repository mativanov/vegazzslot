/**
 * reels.js - Reel strip management and spin animation
 * Vegazz Slot
 */

'use strict';

const Reels = (() => {
  const columns = Array.from(
    { length: Config.REEL.COLUMNS },
    (_, i) => document.getElementById(`col-${i}`)
  );

  function createCell(symbolId) {
    const sym = SymbolPicker.get(symbolId);
    const cell = document.createElement('div');
    cell.dataset.id = symbolId;
    cell.dataset.type = sym.type;
    cell.dataset.symbol = sym.code;
    cell.className = `symbol-cell symbol-cell--${sym.code}`;

    const shine = document.createElement('span');
    shine.className = 'symbol-shine';

    const icon = document.createElement('span');
    icon.className = 'symbol-glyph';
    icon.textContent = sym.glyph;

    const label = document.createElement('span');
    label.className = 'symbol-caption';
    label.textContent = sym.label;

    cell.appendChild(shine);
    cell.appendChild(icon);
    cell.appendChild(label);
    return cell;
  }

  function prependCells(col, count) {
    for (let i = 0; i < count; i++) {
      col.prepend(createCell(SymbolPicker.random()));
    }
  }

  function trimColumn(col) {
    const cells = Array.from(col.children);
    for (let i = Config.REEL.VISIBLE_ROWS; i < cells.length; i++) {
      cells[i].remove();
    }
  }

  function resetPosition(col) {
    col.style.transition = '0s';
    col.style.bottom = '0px';
  }

  return {
    init() {
      columns.forEach(col => {
        col.innerHTML = '';
        prependCells(col, Config.REEL.VISIBLE_ROWS);
      });
    },

    spin({ onColumnStop, onComplete }) {
      const { SPIN_DEPTH, SPIN_DURATION_BASE, SPIN_DURATION_STEP, CELL_PX, VISIBLE_ROWS } = Config.REEL;

      columns.forEach((col, i) => prependCells(col, SPIN_DEPTH[i]));

      let settledCount = 0;
      const totalCols = columns.length;
      let allDone = false;

      function settleColumn(col, i) {
        if (col.dataset.settled === 'true') return;
        col.dataset.settled = 'true';
        col.ontransitionend = null;
        if (onColumnStop) onColumnStop(i);
        trimColumn(col);
        resetPosition(col);

        settledCount++;
        if (settledCount === totalCols && !allDone) {
          allDone = true;
          if (onComplete) onComplete();
        }
      }

      columns.forEach((col, i) => {
        col.dataset.settled = 'false';
        const totalDuration = SPIN_DURATION_BASE + i * SPIN_DURATION_STEP;
        const totalRows = col.children.length;
        const totalScrollPx = (totalRows - VISIBLE_ROWS) * CELL_PX;

        const phase1Ratio = 0.78;
        const phase1Duration = totalDuration * phase1Ratio;
        const phase2Duration = totalDuration * (1 - phase1Ratio);
        const phase1Scroll = Math.floor(totalScrollPx * phase1Ratio);

        col.classList.add('column--spinning');
        void col.offsetHeight;

        col.style.transition = `${phase1Duration}s linear`;
        col.style.bottom = `-${phase1Scroll}px`;
        col.ontransitionend = null;

        setTimeout(() => {
          if (col.dataset.settled === 'true') return;
          col.classList.remove('column--spinning');
          col.style.transition = `${phase2Duration}s cubic-bezier(0, 0, 0.18, 1)`;
          col.style.bottom = `-${totalScrollPx}px`;

          col.ontransitionend = () => {
            settleColumn(col, i);
          };
        }, phase1Duration * 1000);

        setTimeout(() => {
          settleColumn(col, i);
        }, totalDuration * 1000 + 120);
      });

      const fullDuration = SPIN_DURATION_BASE + (totalCols - 1) * SPIN_DURATION_STEP;
      setTimeout(() => {
        if (!allDone) {
          columns.forEach((col, i) => settleColumn(col, i));
        }
      }, fullDuration * 1000 + 220);

      return fullDuration;
    },

    readGrid() {
      const grid = Array.from({ length: Config.REEL.VISIBLE_ROWS }, () => []);

      columns.forEach(col => {
        const cells = Array.from(col.children);
        for (let row = 0; row < Config.REEL.VISIBLE_ROWS; row++) {
          const cell = cells[row];
          grid[row].push(cell ? Number(cell.dataset.id) : 0);
        }
      });

      return grid;
    },

    highlightCell(col, row, cls) {
      const column = columns[col];
      const cells = Array.from(column.children);
      if (cells[row]) cells[row].classList.add(cls);
    },

    clearHighlights() {
      columns.forEach(col => {
        Array.from(col.children).forEach(cell => {
          cell.classList.remove('bg', 'bg-wild', 'bg-scatter');
        });
      });
    },

    get count() {
      return columns.length;
    },
  };
})();

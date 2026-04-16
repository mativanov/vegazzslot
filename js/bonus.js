/**
 * bonus.js — Free Spins bonus round manager
 * Neon Reels — Underground Casino
 *
 * Responsibilities:
 *  - Track free spin count and bonus state
 *  - Show / hide bonus UI overlays and indicators
 *  - Apply win multiplier during free spins
 *  - Emit events back to Game controller when spins are exhausted
 */

'use strict';

const Bonus = (() => {

  // ── State ──────────────────────────────────────────────────
  let freeSpinsRemaining = 0;
  let bonusActive        = false;
  let bonusWinTotal      = 0;

  // ── DOM references ─────────────────────────────────────────
  const overlay       = document.getElementById('bonus-overlay');
  const startBtn      = document.getElementById('bonus-start-btn');
  const spinsCountEl  = document.getElementById('bonus-spins-count');
  const modeBar       = document.getElementById('bonus-mode-bar');
  const modeRemaining = document.getElementById('bonus-mode-remaining');
  const gameArea      = document.getElementById('game-area');
  const elFreeSpins   = document.getElementById('el-free-spins');
  const txtFreeSpins  = document.getElementById('txt-free-spins');

  // ── Callbacks set by Game ───────────────────────────────────
  let onBonusStart = null;   // Called when player presses "Play Free Spins"
  let onBonusEnd   = null;   // Called when all free spins are exhausted

  // ── Private helpers ────────────────────────────────────────

  function showOverlay(spinsAwarded) {
    spinsCountEl.textContent = spinsAwarded;
    overlay.classList.add('bonus-overlay--show');
  }

  function hideOverlay() {
    overlay.classList.remove('bonus-overlay--show');
  }

  function updateModeBar() {
    modeRemaining.textContent = `${freeSpinsRemaining} remaining`;
    txtFreeSpins.textContent  = freeSpinsRemaining;
  }

  // ── Public API ─────────────────────────────────────────────

  return {

    /**
     * Register callbacks from the Game controller.
     * @param {{ onStart: Function, onEnd: Function }} callbacks
     */
    register({ onStart, onEnd }) {
      onBonusStart = onStart;
      onBonusEnd   = onEnd;

      startBtn.addEventListener('click', () => {
        hideOverlay();
        if (onBonusStart) onBonusStart();
      });
    },

    /**
     * Trigger the bonus round (called by Game when scatter count >= threshold).
     * @param {number} [spinsAwarded]  Defaults to Config value
     */
    trigger(spinsAwarded = Config.BONUS.FREE_SPINS_AWARDED) {
      freeSpinsRemaining = spinsAwarded;
      bonusActive        = true;
      bonusWinTotal      = 0;

      // Show header free-spin counter
      elFreeSpins.style.display = 'block';
      txtFreeSpins.textContent  = freeSpinsRemaining;

      // Activate mode bar
      modeBar.classList.add('bonus-mode-bar--active');
      updateModeBar();

      // Tint the game area
      gameArea.classList.add('game-area--bonus');

      // Show announcement overlay
      showOverlay(spinsAwarded);
    },

    /**
     * Called by Game before each spin to check if bonus is active.
     * @returns {boolean}
     */
    isActive() { return bonusActive; },

    /**
     * Returns the win multiplier for the current spin.
     * @returns {number}
     */
    getMultiplier() {
      return bonusActive ? Config.BONUS.WIN_MULTIPLIER : 1;
    },

    /**
     * Called by Game after each bonus spin resolves.
     * Decrements count and fires onBonusEnd when exhausted.
     * @param {number} spinWin  Payout from this spin (may be 0)
     */
    consumeSpin(spinWin) {
      bonusWinTotal      += spinWin;
      freeSpinsRemaining -= 1;

      updateModeBar();

      if (freeSpinsRemaining <= 0) {
        bonusActive = false;

        // Remove bonus UI
        elFreeSpins.style.display = 'none';
        modeBar.classList.remove('bonus-mode-bar--active');
        gameArea.classList.remove('game-area--bonus');

        if (onBonusEnd) onBonusEnd(bonusWinTotal);
        bonusWinTotal = 0;
      }
    },

    /**
     * Returns remaining free spins (0 when inactive).
     * @returns {number}
     */
    getRemaining() { return freeSpinsRemaining; },

    /**
     * Returns accumulated bonus winnings.
     * @returns {number}
     */
    getBonusWinTotal() { return bonusWinTotal; },

  };

})();

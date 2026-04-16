/**
 * game.js - Main controller
 * Vegazz Slot
 */

'use strict';

const Game = (() => {
  const state = {
    money: 0,
    bet: Config.BET.DEFAULT,
    started: false,
    spinning: false,
    soundEnabled: true,
    statsVisible: false,
    sessionStartedAt: null,

    spins: 0,
    wins: 0,
    bestWin: 0,
    totalWagered: 0,
    totalReturned: 0,
    bonusReturned: 0,

    pendingBonus: false,
  };
  let spinFailsafeTimer = null;

  function init() {
    bindControls();
    Bonus.register({ onStart: onBonusStart, onEnd: onBonusEnd });
    UI.registerBigWinDismiss(() => UI.hideBigWin());
    Gamble.init();
  }

  function bindControls() {
    document.getElementById('btn-putmoney').addEventListener('click', () => {
      Audio.unlock();

      if (!state.started) {
        state.money = Config.BET.DEPOSIT_AMOUNT;
        state.started = true;
        state.sessionStartedAt = Date.now();
        Reels.init();
        UI.showGame();
        UI.startSessionClock(state.sessionStartedAt);
        UI.updateMoney(state.money, state.bet);
        UI.updateStats(buildStatsPayload());
        UI.enableSpin();
        if (state.soundEnabled) Audio.playCash();
        UI.toast(`${UI.formatCredits(Config.BET.DEPOSIT_AMOUNT)} credits loaded`);
      } else {
        state.money = Number((state.money + Config.BET.DEPOSIT_TOP_UP).toFixed(2));
        UI.updateMoney(state.money, state.bet);
        if (state.soundEnabled) Audio.playCash();
        UI.toast(`+${UI.formatCredits(Config.BET.DEPOSIT_TOP_UP)} credits added`);
      }
    });

    document.getElementById('bet-chips').addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip || !state.started || state.spinning) return;
      Audio.unlock();
      if (state.soundEnabled) Audio.playClick();
      state.bet = Number(chip.dataset.bet);
      UI.updateBet(state.bet);
      UI.setActiveBetChip(state.bet);
      UI.updateMoney(state.money, state.bet);
    });

    document.getElementById('btn-spin').addEventListener('click', () => {
      Audio.unlock();
      triggerSpin();
    });

    const btnSound = document.getElementById('btn-sound');
    btnSound.classList.add('active');
    btnSound.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      btnSound.textContent = state.soundEnabled ? '🔊' : '🔇';
      btnSound.classList.toggle('active', state.soundEnabled);
      btnSound.classList.toggle('btn-icon--muted', !state.soundEnabled);
      Audio.unlock();
    });

    const statsModal = document.getElementById('stats-modal');
    const btnStats = document.getElementById('btn-stats');
    const btnStatsClose = document.getElementById('stats-modal-close');
    const btnStatsBackdrop = document.getElementById('stats-modal-backdrop');

    const syncStatsModal = () => {
      statsModal.classList.toggle('stats-modal--show', state.statsVisible);
      btnStats.classList.toggle('active', state.statsVisible);
    };

    btnStats.addEventListener('click', () => {
      state.statsVisible = !state.statsVisible;
      syncStatsModal();
    });

    btnStatsClose.addEventListener('click', () => {
      state.statsVisible = false;
      syncStatsModal();
    });

    btnStatsBackdrop.addEventListener('click', () => {
      state.statsVisible = false;
      syncStatsModal();
    });
  }

  function canAffordSpin() {
    return state.money >= state.bet;
  }

  function clearSpinFailsafe() {
    if (spinFailsafeTimer) {
      clearTimeout(spinFailsafeTimer);
      spinFailsafeTimer = null;
    }
  }

  function releaseSpinLock(isBonusMode = Bonus.isActive()) {
    clearSpinFailsafe();
    state.spinning = false;
    UI.setSpinning(false, isBonusMode);
  }

  function armSpinFailsafe(timeoutMs = 12000) {
    clearSpinFailsafe();
    spinFailsafeTimer = setTimeout(() => {
      releaseSpinLock(Bonus.isActive());
      UI.toast('Spin reset after timeout');
    }, timeoutMs);
  }

  function handleRuntimeError(error) {
    console.error(error);
    releaseSpinLock(false);
    UI.hideBigWin();
    UI.toast('Unexpected error. Spin unlocked.');
  }

  function triggerSpin() {
    if (!state.started || state.spinning) return;

    const isFreeSpin = Bonus.isActive();
    if (!isFreeSpin) {
      if (!canAffordSpin()) {
        if (state.soundEnabled) Audio.playError();
        UI.toast('Insufficient credits');
        UI.updateMoney(state.money, state.bet);
        return;
      }

      state.money = Number((state.money - state.bet).toFixed(2));
      state.totalWagered = Number((state.totalWagered + state.bet).toFixed(2));
    }

    state.spins += 1;
    state.spinning = true;
    armSpinFailsafe();

    UI.clearPaylines();
    UI.hideWinBanner();
    UI.hideWinAmount();
    Reels.clearHighlights();

    UI.setSpinning(true);
    UI.updateMoney(state.money, state.bet);
    UI.updateStats(buildStatsPayload());

    try {
      const multiplier = Bonus.getMultiplier();
      const totalDuration = Reels.spin({
        onColumnStop: colIndex => {
          if (state.soundEnabled) Audio.playReelStop(colIndex);
        },
        onComplete: () => onSpinComplete(multiplier),
      });

      if (state.soundEnabled) Audio.playSpin(totalDuration);
    } catch (error) {
      handleRuntimeError(error);
    }
  }

  function onSpinComplete(multiplier) {
    try {
      const grid = Reels.readGrid();
      const result = Paylines.evaluate(grid, state.bet, multiplier);

      resolveHighlights(result);
      resolveWin(result);
    } catch (error) {
      handleRuntimeError(error);
    }
  }

  function resolveHighlights(result) {
    const grid = Reels.readGrid();

    result.scatterCols.forEach(col => {
      for (let row = 0; row < Config.REEL.VISIBLE_ROWS; row++) {
        if (grid[row][col] === Paylines.SCATTER_ID) {
          Reels.highlightCell(col, row, 'bg-scatter');
        }
      }
    });

    result.lineWins.forEach(win => {
      for (let col = 0; col < Config.REEL.COLUMNS; col++) {
        if (win.row[col] === win.symbol || win.wildPositions.has(col)) {
          const cssClass = win.wildPositions.has(col) ? 'bg-wild' : 'bg';
          Reels.highlightCell(col, win.rowIndex, cssClass);
        }
      }
      UI.activatePayline(win.rowIndex);
    });
  }

  function resolveWin(result) {
    const { totalPayout, lineWins, scatterCount } = result;
    const isBonusSpin = Bonus.isActive();
    const netGain = isBonusSpin ? totalPayout : Number((totalPayout - state.bet).toFixed(2));
    const isPositiveOutcome = isBonusSpin ? totalPayout > 0 : totalPayout > state.bet;

    if (scatterCount > 0 && state.soundEnabled) Audio.playScatter();

    if (lineWins.length > 0) {
      state.money = Number((state.money + totalPayout).toFixed(2));
      state.totalReturned = Number((state.totalReturned + totalPayout).toFixed(2));
      state.wins += 1;

      if (isBonusSpin) {
        state.bonusReturned = Number((state.bonusReturned + totalPayout).toFixed(2));
      }
      if (totalPayout > state.bestWin) state.bestWin = totalPayout;

      UI.updateMoney(state.money, state.bet);
      UI.updateStats(buildStatsPayload());

      const bannerParts = lineWins.map(w => `${w.name} +${UI.formatCredits(w.payout)}`);
      const bannerColour = isPositiveOutcome
        ? lineWins[0].rowIndex === 1 ? 'gold' : lineWins[0].rowIndex === 0 ? 'blue' : 'red'
        : 'neutral';

      UI.showWinBanner(
        isPositiveOutcome ? bannerParts.join(' · ') : `Return ${UI.formatCredits(totalPayout)}`,
        bonusColour(bannerColour)
      );
      UI.showWinAmount(totalPayout, { positive: isPositiveOutcome });

      const betMult = totalPayout / state.bet;
      if (isPositiveOutcome) {
        if (betMult >= Config.WIN_TIER.JACKPOT) {
          if (state.soundEnabled) Audio.playBigWin();
          UI.shake();
          UI.spawnCoins(35);
          setTimeout(() => UI.showBigWin(totalPayout), 500);
        } else if (betMult >= Config.WIN_TIER.BIG) {
          if (state.soundEnabled) Audio.playBigWin();
          UI.shake();
          UI.spawnCoins(20);
        } else {
          if (state.soundEnabled) Audio.playWin();
          if (betMult >= Config.WIN_TIER.MEDIUM) UI.spawnCoins(8);
        }
      } else {
        UI.toast(`Partial return: ${UI.formatCredits(totalPayout)}`);
      }

      UI.addTickerEntry({
        spinNum: state.spins,
        amount: totalPayout,
        isBonus: isBonusSpin,
        bet: state.bet,
        net: netGain,
      });

      if (!Bonus.isActive()) {
        const delayBeforeGamble = betMult >= Config.WIN_TIER.JACKPOT ? 1800 : 1400;
        setTimeout(() => {
          UI.hideBigWin();
          state.money = Number((state.money - totalPayout).toFixed(2));
          state.totalReturned = Number((state.totalReturned - totalPayout).toFixed(2));
          UI.updateMoney(state.money, state.bet);

          Gamble.offer(totalPayout, (finalWin) => {
            state.money = Number((state.money + finalWin).toFixed(2));
            state.totalReturned = Number((state.totalReturned + finalWin).toFixed(2));
            if (finalWin > state.bestWin) state.bestWin = finalWin;
            UI.updateMoney(state.money, state.bet);
            UI.updateStats(buildStatsPayload());

            if (finalWin > totalPayout) {
              UI.toast(`Dupliranje won: +${UI.formatCredits(finalWin)}`);
              UI.spawnCoins(Math.min(Math.floor(finalWin / state.bet), 30));
            } else if (finalWin === 0) {
              UI.toast('Dupliranje lost');
            }

            resolveAfterSpin(result);
          }, !state.soundEnabled);
        }, delayBeforeGamble);
        return;
      }
    } else {
      UI.addTickerEntry({
        spinNum: state.spins,
        amount: 0,
        isBonus: false,
        bet: state.bet,
        net: -state.bet,
      });
    }

    resolveAfterSpin(result);
  }

  function resolveAfterSpin(result) {
    const { totalPayout, lineWins, scatterCount } = result;

    if (Bonus.isActive()) {
      Bonus.consumeSpin(totalPayout);
    } else if (scatterCount >= Config.BONUS.SCATTER_TRIGGER_COUNT) {
      resolveScatterTrigger();
      return;
    }

    const delay = lineWins.length > 0 ? 400 : 0;
    setTimeout(postSpin, delay);
  }

  function resolveScatterTrigger() {
    if (state.soundEnabled) Audio.playBonusTrigger();
    UI.showWinBanner(`3 scatters - ${Config.BONUS.FREE_SPINS_AWARDED} free spins`, 'bonus');
    state.pendingBonus = true;

    setTimeout(() => {
      Bonus.trigger();
    }, 800);
  }

  function onBonusStart() {
    state.pendingBonus = false;
    releaseSpinLock(true);
  }

  function onBonusEnd(bonusTotalWin) {
    UI.updateStats(buildStatsPayload());
    UI.toast(`Bonus complete: ${UI.formatCredits(bonusTotalWin)}`);
    releaseSpinLock(false);
  }

  function postSpin() {
    releaseSpinLock(Bonus.isActive());
  }

  function bonusColour(base) {
    return Bonus.isActive() ? 'bonus' : base;
  }

  function buildStatsPayload() {
    return {
      spins: state.spins,
      wins: state.wins,
      bestWin: state.bestWin,
      wagered: state.totalWagered,
      returned: state.totalReturned,
      bonusReturned: state.bonusReturned,
      netResult: Number((state.totalReturned - state.totalWagered).toFixed(2)),
    };
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    getState: () => ({ ...state }),
  };
})();

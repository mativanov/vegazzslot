/**
 * ui.js - DOM updates, stats panel, overlays, particles, ticker
 * Vegazz Slot
 */

'use strict';

const UI = (() => {
  const txtMoney = document.getElementById('txt-money');
  const txtBet = document.getElementById('txt-bet');
  const elWin = document.getElementById('el-win');
  const txtWin = document.getElementById('txt-win');
  const toastEl = document.getElementById('toast');
  const bigwinOverlay = document.getElementById('bigwin-overlay');
  const bigwinAmount = document.getElementById('bigwin-amount');
  const coinContainer = document.getElementById('coin-container');
  const winBanner = document.getElementById('win-banner');
  const machine = document.getElementById('machine');
  const emptyOverlay = document.getElementById('empty-overlay');
  const winsTicker = document.getElementById('wins-ticker');

  const paylineBars = [
    document.querySelector('.payline-bar--1'),
    document.querySelector('.payline-bar--2'),
    document.querySelector('.payline-bar--3'),
  ];

  const statSpins = document.getElementById('stat-spins');
  const statWins = document.getElementById('stat-wins');
  const statBest = document.getElementById('stat-best');
  const statRate = document.getElementById('stat-rate');
  const statNet = document.getElementById('stat-net');
  const statElapsed = document.getElementById('stat-elapsed');
  const rtpDisplay = document.getElementById('rtp-display');
  const rtpGauge = document.getElementById('rtp-gauge');
  const rtpFill = document.getElementById('rtp-fill') || rtpGauge;
  const rtpBarValue = document.getElementById('rtp-bar-value');
  const totalWagEl = document.getElementById('total-wagered');
  const totalRetEl = document.getElementById('total-returned');
  const bonusWinsEl = document.getElementById('bonus-winnings');
  const theoreticalRtpEl = document.getElementById('theoretical-rtp');
  const targetRtpEl = document.getElementById('target-rtp');
  const bonusRateEl = document.getElementById('bonus-rate');
  const volatilityEl = document.getElementById('volatility-label');

  let toastTimer = null;
  let sessionClockTimer = null;
  let sessionStartedAt = null;
  let bigwinTimer = null;

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  function formatCredits(value) {
    const amount = Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: Number.isInteger(Number(value || 0)) ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return `$${amount}`;
  }

  function formatSignedCredits(value) {
    const num = Number(value || 0);
    const prefix = num > 0 ? '+' : '';
    return `${prefix}${formatCredits(num)}`;
  }

  function formatElapsed(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function rtpPercent(wagered, returned) {
    if (wagered === 0) return null;
    return Number(((returned / wagered) * 100).toFixed(1));
  }

  function renderSessionElapsed() {
    if (!statElapsed) return;

    if (!sessionStartedAt) {
      statElapsed.textContent = '00:00';
      return;
    }

    statElapsed.textContent = formatElapsed(Date.now() - sessionStartedAt);
  }

  if (theoreticalRtpEl) theoreticalRtpEl.textContent = `${Config.GAME.TARGET_RTP}%`;
  if (targetRtpEl) targetRtpEl.textContent = `${Config.GAME.TARGET_RTP}%`;
  if (bonusRateEl) bonusRateEl.textContent = Config.GAME.BONUS_RATE_LABEL;
  if (volatilityEl) volatilityEl.textContent = Config.GAME.VOLATILITY;

  return {
    formatCredits,

    showGame() {
      emptyOverlay.classList.add('hidden');
    },

    startSessionClock(startedAt) {
      sessionStartedAt = startedAt;
      renderSessionElapsed();
      clearInterval(sessionClockTimer);
      sessionClockTimer = setInterval(renderSessionElapsed, 1000);
    },

    updateMoney(money, bet) {
      txtMoney.textContent = formatCredits(money);
      txtBet.textContent = formatCredits(bet);

      if (money <= 0 || money < bet) {
        txtMoney.classList.add('stat-value--danger');
      } else {
        txtMoney.classList.remove('stat-value--danger');
      }
    },

    updateBet(bet) {
      txtBet.textContent = formatCredits(bet);
    },

    showWinAmount(amount, { positive = true } = {}) {
      elWin.style.display = 'block';
      txtWin.textContent = formatSignedCredits(amount);
      txtWin.classList.toggle('stat-value--neutral', !positive);
      txtWin.classList.toggle('stat-value--win', positive);
    },

    hideWinAmount() {
      elWin.style.display = 'none';
      txtWin.classList.remove('stat-value--neutral');
      txtWin.classList.add('stat-value--win');
    },

    showWinBanner(text, colour = 'gold') {
      winBanner.textContent = text;
      winBanner.className = `win-banner win-banner--show win-banner--${colour}`;
    },

    hideWinBanner() {
      winBanner.className = 'win-banner';
    },

    activatePayline(rowIndex) {
      const bar = paylineBars[rowIndex];
      if (bar) bar.classList.add('payline-bar--active');
    },

    clearPaylines() {
      paylineBars.forEach(bar => {
        if (bar) bar.classList.remove('payline-bar--active', 'payline-bar--flash');
      });
    },

    flashPayline(rowIndex) {
      const bar = paylineBars[rowIndex];
      if (!bar) return;
      bar.classList.add('payline-bar--flash');
      bar.addEventListener('animationend', () => {
        bar.classList.remove('payline-bar--flash');
      }, { once: true });
    },

    shake() {
      machine.classList.add('machine--shaking');
      machine.addEventListener('animationend', () => {
        machine.classList.remove('machine--shaking');
      }, { once: true });
    },

    showBigWin(amount) {
      clearTimeout(bigwinTimer);
      bigwinAmount.textContent = formatCredits(amount);
      bigwinOverlay.classList.add('bigwin-overlay--show');
      bigwinTimer = setTimeout(() => {
        bigwinOverlay.classList.remove('bigwin-overlay--show');
      }, 2600);
    },

    hideBigWin() {
      clearTimeout(bigwinTimer);
      bigwinOverlay.classList.remove('bigwin-overlay--show');
    },

    registerBigWinDismiss(cb) {
      bigwinOverlay.addEventListener('click', cb);
    },

    spawnCoins(count) {
      const cappedCount = clamp(count, 0, 40);
      for (let i = 0; i < cappedCount; i++) {
        setTimeout(() => {
          const coin = document.createElement('div');
          coin.className = 'coin';
          coin.textContent = '🪙';
          coin.style.left = `${Math.random() * 100}%`;
          coin.style.top = '-30px';
          const dur = 1.4 + Math.random() * 1.4;
          coin.style.animation = `coinFall ${dur}s ease-in forwards`;
          coinContainer.appendChild(coin);
          setTimeout(() => coin.remove(), (dur + 0.1) * 1000);
        }, i * 55);
      }
    },

    toast(message, duration = 1800) {
      clearTimeout(toastTimer);
      toastEl.textContent = message;
      toastEl.classList.add('toast--show');
      toastTimer = setTimeout(() => toastEl.classList.remove('toast--show'), duration);
    },

    setActiveBetChip(bet) {
      document.querySelectorAll('.chip').forEach(chip => {
        const isActive = Number(chip.dataset.bet) === bet;
        chip.classList.toggle('chip--active', isActive);
        chip.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });
    },

    setSpinning(isSpinning, isBonusMode = false) {
      const btn = document.getElementById('btn-spin');
      btn.disabled = isSpinning;

      btn.classList.toggle('btn-spin--spinning', isSpinning);
      btn.classList.toggle('btn-spin--bonus', !isSpinning && isBonusMode);

      const textEl = btn.querySelector('.btn-spin-text');
      if (textEl) {
        textEl.textContent = isSpinning ? '...' : (isBonusMode ? 'FREE' : 'SPIN');
      }
    },

    enableSpin() {
      document.getElementById('btn-spin').disabled = false;
    },

    disableSpin() {
      document.getElementById('btn-spin').disabled = true;
    },

    addTickerEntry({ spinNum, amount, isBonus, bet, net = amount }) {
      const placeholder = winsTicker.querySelector('.win-entry--neutral');
      if (placeholder?.querySelector('.we-label')?.textContent === 'Awaiting first spin…') {
        placeholder.remove();
      }

      const entry = document.createElement('div');
      entry.className = 'win-entry';

      let variant = 'win-entry--neutral';
      let labelTxt = `Spin #${spinNum}`;
      let amountTxt = '—';

      if (amount === 0) {
        variant = 'win-entry--neutral';
      } else if (isBonus) {
        variant = 'win-entry--bonus';
        labelTxt = `Bonus #${spinNum}`;
        amountTxt = formatSignedCredits(amount);
      } else if (net <= 0) {
        variant = 'win-entry--return';
        labelTxt = `Spin #${spinNum} return`;
        amountTxt = formatCredits(amount);
      } else if (amount >= bet * Config.WIN_TIER.JACKPOT) {
        variant = 'win-entry--jackpot';
        amountTxt = formatSignedCredits(amount);
      } else if (amount >= bet * Config.WIN_TIER.BIG) {
        variant = 'win-entry--big';
        amountTxt = formatSignedCredits(amount);
      } else {
        variant = 'win-entry--small';
        amountTxt = formatSignedCredits(amount);
      }

      entry.classList.add(variant);
      entry.innerHTML = `
        <span class="we-label">${labelTxt}</span>
        <span class="we-amount">${amountTxt}</span>
      `;

      winsTicker.insertBefore(entry, winsTicker.firstChild);

      while (winsTicker.children.length > 10) {
        winsTicker.removeChild(winsTicker.lastChild);
      }
    },

    updateStats({ spins, wins, bestWin, wagered, returned, bonusReturned, netResult }) {
      if (statSpins) statSpins.textContent = spins;
      if (statWins) statWins.textContent = wins;
      if (statBest) statBest.textContent = formatCredits(bestWin);

      const rate = spins > 0 ? Number(((wins / spins) * 100).toFixed(1)) : 0;
      if (statRate) statRate.textContent = `${rate}%`;

      if (statNet) {
        statNet.textContent = formatSignedCredits(netResult);
        statNet.classList.toggle('session-value--loss', netResult < 0);
        statNet.classList.toggle('session-value--gain', netResult > 0);
      }

      if (totalWagEl) totalWagEl.textContent = formatCredits(wagered);
      if (totalRetEl) totalRetEl.textContent = formatCredits(returned);
      if (bonusWinsEl) bonusWinsEl.textContent = formatCredits(bonusReturned);

      const rtp = rtpPercent(wagered, returned);
      if (rtp !== null) {
        const rtpStr = `${rtp}%`;
        if (rtpDisplay) rtpDisplay.textContent = rtpStr;
        if (rtpBarValue) rtpBarValue.textContent = `${rtpStr} / ${Config.GAME.TARGET_RTP}%`;
        const pct = clamp(rtp, 0, 100);
        if (rtpGauge) rtpGauge.style.width = `${pct}%`;
        if (rtpFill && rtpFill !== rtpGauge) rtpFill.style.width = `${pct}%`;
      }

      renderSessionElapsed();
    },
  };
})();

/**
 * gamble.js - Post-win gamble feature
 */

'use strict';

const Gamble = (() => {
  const MAX_ROUNDS = 5;
  const RESOLVE_DELAY_MS = 650;

  const SUITS = [
    { id: 'hearts', emoji: '\u2665', color: 'red' },
    { id: 'diamonds', emoji: '\u2666', color: 'red' },
    { id: 'spades', emoji: '\u2660', color: 'black' },
    { id: 'clubs', emoji: '\u2663', color: 'black' },
  ];

  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const RANK_VALUE = Object.fromEntries(RANKS.map((rank, index) => [rank, index]));

  let pendingWin = 0;
  let roundsLeft = 0;
  let resolveCallback = null;
  let soundEnabled = true;
  let lockedMode = null;
  let hiloBaseRank = null;
  let hiloBaseSuitObj = null;
  let interactionLocked = false;
  let roundResolveTimer = null;
  let sessionToken = 0;

  let overlay;
  let cardFront;
  let cardInner;
  let resultCardFront;
  let resultCardInner;
  let txtCurrentWin;
  let txtPotential;
  let txtRoundsLeft;
  let btnCollectTop;
  let stageDecide;
  let stageModeSelect;
  let stagePlay;
  let stageResult;
  let playTitle;
  let playInstructions;
  let colorBtns;
  let suitBtns;
  let hiloSection;
  let hiloBaseRankEl;
  let hiloBaseSuitEl;
  let resultIcon;
  let resultText;
  let resultAmount;
  let btnResultNext;
  let btnResultEnd;

  function sfx(fn) {
    if (soundEnabled) {
      try {
        fn();
      } catch (_) {}
    }
  }

  function randomSuit() {
    return SUITS[Math.floor(Math.random() * SUITS.length)];
  }

  function randomRank() {
    return RANKS[Math.floor(Math.random() * RANKS.length)];
  }

  function renderCardEl(el, rank, suit) {
    const colorClass = suit.color === 'red' ? 'card-red' : 'card-black';
    el.innerHTML =
      `<span class="card-rank ${colorClass}">${rank}</span>` +
      `<span class="card-suit ${colorClass}">${suit.emoji}</span>`;
  }

  function formatMoney(value) {
    const amount = Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: Number.isInteger(Number(value || 0)) ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return `$${amount}`;
  }

  function flipReveal(rank, suit) {
    renderCardEl(cardFront, rank, suit);
    renderCardEl(resultCardFront, rank, suit);
    cardInner.classList.add('flipped');
    resultCardInner.classList.add('flipped');
  }

  function resetCard() {
    cardInner.classList.remove('flipped');
    resultCardInner.classList.remove('flipped');
    cardFront.innerHTML = '';
    resultCardFront.innerHTML = '';
  }

  function clearRoundTimer() {
    if (roundResolveTimer) {
      clearTimeout(roundResolveTimer);
      roundResolveTimer = null;
    }
  }

  function lockInteraction() {
    interactionLocked = true;
    overlay.classList.add('gamble-overlay--busy');
  }

  function unlockInteraction() {
    interactionLocked = false;
    overlay.classList.remove('gamble-overlay--busy');
  }

  function canInteract() {
    return !interactionLocked && overlay.classList.contains('gamble-overlay--show');
  }

  function showStage(name) {
    [stageDecide, stageModeSelect, stagePlay, stageResult].forEach(stage => {
      stage.classList.remove('gamble-stage--active');
    });

    const stageMap = {
      decide: stageDecide,
      mode: stageModeSelect,
      play: stagePlay,
      result: stageResult,
    };

    if (stageMap[name]) {
      stageMap[name].classList.add('gamble-stage--active');
    }
  }

  function updateDisplay() {
    txtCurrentWin.textContent = formatMoney(pendingWin);
    txtRoundsLeft.textContent = roundsLeft;

    const multiplierByMode = { color: 2, suit: 4, hilo: 2 };
    const multiplier = lockedMode ? multiplierByMode[lockedMode] : 2;
    txtPotential.textContent = formatMoney(pendingWin * multiplier);
  }

  function dealHiloBase() {
    resetCard();
    hiloBaseRank = randomRank();
    hiloBaseSuitObj = randomSuit();

    const colorClass = hiloBaseSuitObj.color === 'red' ? 'card-red' : 'card-black';
    hiloBaseRankEl.textContent = hiloBaseRank;
    hiloBaseRankEl.className = `hilo-rank ${colorClass}`;
    hiloBaseSuitEl.textContent = hiloBaseSuitObj.emoji;
    hiloBaseSuitEl.className = `hilo-suit ${colorClass}`;
    sfx(() => Audio.playClick());
  }

  function activateMode(mode) {
    lockedMode = mode;
    updateDisplay();

    const labels = {
      color: { title: 'Pick a Color', sub: 'Correct choice pays x2. Wrong choice loses the current win.' },
      suit: { title: 'Pick a Suit', sub: 'Call the exact suit to win x4. Any miss ends the gamble.' },
      hilo: { title: 'Higher or Lower?', sub: 'Higher or lower pays x2. Exact same rank pays x8.' },
    };

    playTitle.textContent = labels[mode].title;
    playInstructions.textContent = labels[mode].sub;

    colorBtns.style.display = mode === 'color' ? 'flex' : 'none';
    suitBtns.style.display = mode === 'suit' ? 'flex' : 'none';
    hiloSection.style.display = mode === 'hilo' ? 'flex' : 'none';

    if (mode === 'hilo') {
      dealHiloBase();
    } else {
      resetCard();
    }

    showStage('play');
  }

  function resolveGuess(won, multiplier, message) {
    if (won) {
      pendingWin = Math.floor(pendingWin * multiplier);
      roundsLeft -= 1;
      sfx(() => (multiplier >= 4 ? Audio.playBigWin() : Audio.playWin()));
    } else {
      pendingWin = 0;
      sfx(() => Audio.playError());
    }

    resultIcon.textContent = won ? '\u2713' : '\u2715';
    resultIcon.className = `gamble-result-icon ${won ? 'gamble-result-icon--win' : 'gamble-result-icon--lose'}`;
    resultText.textContent = message;
    resultAmount.textContent = won ? `+${formatMoney(pendingWin)}` : 'WIN LOST';
    resultAmount.className = `gamble-result-amount ${won ? 'gamble-result-amount--win' : 'gamble-result-amount--lose'}`;

    const modeLabels = { color: 'Color', suit: 'Suit', hilo: 'Hi/Lo' };
    btnResultNext.style.display = won && roundsLeft > 0 ? 'inline-flex' : 'none';
    if (won && roundsLeft > 0) {
      btnResultNext.textContent = `Gamble Again (${modeLabels[lockedMode]})`;
    }

    btnResultEnd.textContent = won ? 'Collect' : 'Continue';
    updateDisplay();
    showStage('result');
  }

  function queueResolve(resolver) {
    const token = sessionToken;
    lockInteraction();
    clearRoundTimer();

    roundResolveTimer = setTimeout(() => {
      roundResolveTimer = null;
      if (token !== sessionToken || !resolveCallback) return;
      resolver();
      unlockInteraction();
    }, RESOLVE_DELAY_MS);
  }

  function endGamble(finalWin) {
    sessionToken += 1;
    clearRoundTimer();
    unlockInteraction();
    overlay.classList.remove('gamble-overlay--show');

    if (resolveCallback) {
      const cb = resolveCallback;
      resolveCallback = null;
      cb(finalWin);
    }
  }

  function bindEvents() {
    document.getElementById('gamble-btn-yes').addEventListener('click', () => {
      if (!canInteract()) return;
      lockInteraction();
      showStage('mode');
      sfx(() => Audio.playClick());
      unlockInteraction();
    });

    document.getElementById('gamble-btn-collect').addEventListener('click', () => {
      if (!canInteract()) return;
      endGamble(pendingWin);
    });

    overlay.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!canInteract()) return;
        lockInteraction();
        sfx(() => Audio.playClick());
        activateMode(btn.dataset.mode);
        unlockInteraction();
      });
    });

    overlay.querySelectorAll('[data-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!canInteract()) return;
        const guess = btn.dataset.color;
        const suit = randomSuit();
        const rank = randomRank();

        sfx(() => Audio.playClick());
        flipReveal(rank, suit);

        queueResolve(() => {
          resolveGuess(
            suit.color === guess,
            2,
            suit.color === guess
              ? `${suit.emoji} ${rank} - Correct color. Win doubled.`
              : `${suit.emoji} ${rank} - Wrong color. Win lost.`
          );
        });
      });
    });

    overlay.querySelectorAll('[data-suit]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!canInteract()) return;
        const guess = btn.dataset.suit;
        const suit = randomSuit();
        const rank = randomRank();

        sfx(() => Audio.playClick());
        flipReveal(rank, suit);

        queueResolve(() => {
          resolveGuess(
            suit.id === guess,
            4,
            suit.id === guess
              ? `${suit.emoji} ${rank} - Perfect call. Win x4.`
              : `${suit.emoji} ${rank} - Wrong suit. Win lost.`
          );
        });
      });
    });

    overlay.querySelectorAll('[data-hilo]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!canInteract()) return;
        const guess = btn.dataset.hilo;
        const newSuit = randomSuit();
        const newRank = randomRank();

        sfx(() => Audio.playClick());
        flipReveal(newRank, newSuit);

        queueResolve(() => {
          const baseVal = RANK_VALUE[hiloBaseRank];
          const newVal = RANK_VALUE[newRank];
          let won = false;

          if (guess === 'higher') won = newVal > baseVal;
          if (guess === 'lower') won = newVal < baseVal;
          if (guess === 'same') won = newVal === baseVal;

          const multiplier = guess === 'same' ? 8 : 2;
          const message = won
            ? guess === 'same'
              ? `${newSuit.emoji} ${newRank} - Exact match. Win x8.`
              : `${newSuit.emoji} ${newRank} - Correct call. Win doubled.`
            : `${newSuit.emoji} ${newRank} - Wrong. Win lost.`;

          resolveGuess(won, multiplier, message);
        });
      });
    });

    btnCollectTop.addEventListener('click', () => {
      if (!canInteract()) return;
      endGamble(pendingWin);
    });

    btnResultNext.addEventListener('click', () => {
      if (!canInteract()) return;
      if (pendingWin <= 0) {
        endGamble(0);
        return;
      }

      resetCard();
      updateDisplay();

      if (lockedMode === 'hilo') {
        dealHiloBase();
      }

      showStage('play');
    });

    btnResultEnd.addEventListener('click', () => {
      if (!canInteract()) return;
      endGamble(pendingWin);
    });
  }

  return {
    init() {
      overlay = document.getElementById('gamble-overlay');
      cardFront = document.getElementById('gamble-card-front');
      cardInner = document.querySelector('#gamble-stage-play .gamble-card-inner');
      resultCardFront = document.getElementById('gamble-card-front-result');
      resultCardInner = document.querySelector('#gamble-stage-result .gamble-card-inner');
      txtCurrentWin = document.getElementById('gamble-current-win');
      txtPotential = document.getElementById('gamble-potential');
      txtRoundsLeft = document.getElementById('gamble-rounds-left');
      btnCollectTop = document.getElementById('gamble-collect-top');
      stageDecide = document.getElementById('gamble-stage-decide');
      stageModeSelect = document.getElementById('gamble-stage-mode');
      stagePlay = document.getElementById('gamble-stage-play');
      stageResult = document.getElementById('gamble-stage-result');
      playTitle = document.getElementById('gamble-play-title');
      playInstructions = document.getElementById('gamble-play-instructions');
      colorBtns = document.getElementById('gamble-color-btns');
      suitBtns = document.getElementById('gamble-suit-btns');
      hiloSection = document.getElementById('gamble-hilo-section');
      hiloBaseRankEl = document.getElementById('hilo-base-rank');
      hiloBaseSuitEl = document.getElementById('hilo-base-suit');
      resultIcon = document.getElementById('gamble-result-icon');
      resultText = document.getElementById('gamble-result-text');
      resultAmount = document.getElementById('gamble-result-amount');
      btnResultNext = document.getElementById('gamble-result-next');
      btnResultEnd = document.getElementById('gamble-result-end');

      bindEvents();
    },

    offer(winAmount, onResolve, muted = false) {
      if (winAmount <= 0) {
        onResolve(0);
        return;
      }

      sessionToken += 1;
      clearRoundTimer();
      unlockInteraction();

      pendingWin = winAmount;
      roundsLeft = MAX_ROUNDS;
      resolveCallback = onResolve;
      soundEnabled = !muted;
      lockedMode = null;
      hiloBaseRank = null;
      hiloBaseSuitObj = null;

      resetCard();
      updateDisplay();
      showStage('decide');
      overlay.classList.add('gamble-overlay--show');
    },
  };
})();

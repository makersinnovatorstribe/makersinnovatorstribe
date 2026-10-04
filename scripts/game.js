(() => {
  'use strict';
  const scriptSource = document.currentScript && document.currentScript.src;
  const assetUrl = file => scriptSource
    ? new URL('../assets/images/' + file, scriptSource).href
    : new URL('assets/images/' + file, document.baseURI).href;

  function mountGame() {
    const host = document.getElementById('maker-game');
    if (!host || host.dataset.gameReady) return;
    host.dataset.gameReady = 'true';

    // Standalone objects and official club drawings only. Workshop photographs
    // must never enter the deck: even a small thumbnail can show someone's face.
    const crafts = [
      { id: 'strawberry', name: 'Strawberry bag', image: 'cutouts/strawberry-bag.webp' },
      { id: 'fire-bear', name: 'Fired-up bear', image: 'mascots/mit-mascot-fired-up.png' },
      { id: 'wood', name: 'Layered wood', image: 'cutouts/layered-wood.webp' },
      { id: 'little-bear', name: 'Little maker bear', image: 'mascots/mit-mascot-little-maker.png' },
      { id: 'hammer-bear', name: 'Hammer bear', image: 'mascots/mit-mascot-hammer.png' },
      { id: 'rug', name: 'MIT rug', image: 'cutouts/mascot-rug.webp' }
    ];
    const storageKey = 'mit-maker-memory-best-v1';
    let best = null;
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (Number.isInteger(saved) && saved >= 6) best = saved;
    } catch (_) { /* The game also works when browser storage is unavailable. */ }

    let deck = [], open = [], moves = 0, pairs = 0, running = false, locked = false, hideTimer = null;
    host.innerHTML = `
      <div class="maker-console">
        <div class="maker-console-top"><span>Made for each other.</span><span>12 tokens<br>6 pairs</span></div>
        <div class="maker-screen">
          <div class="maker-scoreboard" aria-label="Game score">
            <span>Moves<strong id="maker-moves">0</strong></span>
            <span>Pairs<strong id="maker-pairs">0 / 6</strong></span>
            <span>Your best<strong id="maker-best">${best === null ? '—' : best}</strong></span>
          </div>
        </div>
        <div class="maker-token-board" id="maker-token-board" role="group" aria-label="Memory game: twelve tokens, six matching pairs" aria-describedby="maker-instructions"></div>
        <p class="maker-message" id="maker-message" role="status" aria-live="polite" aria-atomic="true">Flip a token. Find its match.</p>
        <div class="maker-console-controls">
          <button class="maker-help-button" type="button" id="maker-help-button" aria-expanded="false" aria-controls="maker-help">How to play</button>
          <button class="maker-start" type="button" id="maker-start">Let's play <span aria-hidden="true">↗</span></button>
        </div>
        <p class="maker-instructions" id="maker-instructions">Flip two tokens. Find all six pairs of objects and club bears. You can start by choosing any token.</p>
        <div class="maker-help" id="maker-help" hidden><p>Flip two tokens to reveal objects and club bears. Find all six matching pairs in as few moves as you can. There’s no timer.</p><p>Use Tab and Enter or Space to play with a keyboard; arrow keys move between tokens. Your best score stays on this browser.</p></div>
        <div class="maker-celebration" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<i style="--piece:${i}"></i>`).join('')}</div>
      </div>`;

    const board = host.querySelector('#maker-token-board');
    const message = host.querySelector('#maker-message');
    const start = host.querySelector('#maker-start');
    const scoreMoves = host.querySelector('#maker-moves');
    const scorePairs = host.querySelector('#maker-pairs');
    const scoreBest = host.querySelector('#maker-best');
    const consolePanel = host.querySelector('.maker-console');
    const backImage = assetUrl('MITLogo_Web.webp');

    function shuffle() {
      deck = crafts.flatMap(craft => [{ craft, matched: false, revealed: false }, { craft, matched: false, revealed: false }]);
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }

    function renderBoard() {
      board.innerHTML = deck.map((token, index) => `<button class="maker-token" type="button" data-token="${index}" data-craft="${token.craft.id}" aria-label="Token ${index + 1}, face down. Flip token." aria-pressed="false"><span class="maker-token-inner" aria-hidden="true"><span class="maker-token-back"><img src="${backImage}" alt="" width="280" height="219" draggable="false"></span><span class="maker-token-front"><img src="${assetUrl(token.craft.image)}" alt="" width="160" height="160" draggable="false"></span></span><span class="maker-match-mark" aria-hidden="true">✓</span></button>`).join('');
    }

    function updateToken(index) {
      const token = deck[index], button = board.children[index];
      const faceUp = token.revealed || token.matched;
      button.classList.toggle('is-open', faceUp);
      button.classList.toggle('is-matched', token.matched);
      button.setAttribute('aria-pressed', String(faceUp));
      button.setAttribute('aria-disabled', String(token.matched));
      button.setAttribute('aria-label', `Token ${index + 1}, ${faceUp ? token.craft.name + (token.matched ? ', matched.' : ', face up.') : 'face down. Flip token.'}`);
    }

    function finish() {
      running = false;
      const newBest = best === null || moves < best;
      if (newBest) {
        best = moves;
        scoreBest.textContent = String(best);
        try { localStorage.setItem(storageKey, String(best)); } catch (_) { /* Keep the best score for this session. */ }
      }
      consolePanel.classList.add('is-complete');
      consolePanel.classList.remove('is-playing');
      message.textContent = `All paired up! ${moves} moves.${moves === 6 ? ' A perfect match.' : newBest ? ' Your new best!' : ' One more round?'}`;
      start.innerHTML = 'Play again <span aria-hidden="true">↻</span>';
    }

    function flip(index) {
      if (!running || locked || !deck[index] || deck[index].matched || deck[index].revealed) return;
      deck[index].revealed = true;
      open.push(index);
      updateToken(index);
      if (open.length === 1) {
        message.textContent = `${deck[index].craft.name}. Where's its other half?`;
        return;
      }
      moves++;
      scoreMoves.textContent = String(moves);
      const [first, second] = open;
      if (deck[first].craft.id === deck[second].craft.id) {
        deck[first].matched = deck[second].matched = true;
        updateToken(first);
        updateToken(second);
        pairs++;
        scorePairs.textContent = `${pairs} / 6`;
        open = [];
        message.textContent = `${deck[index].craft.name} matched! ${pairs} of 6 pairs.`;
        if (pairs === 6) finish();
      } else {
        locked = true;
        message.textContent = 'Not quite. Keep those two in mind.';
        hideTimer = window.setTimeout(() => {
          deck[first].revealed = deck[second].revealed = false;
          updateToken(first);
          updateToken(second);
          open = [];
          locked = false;
          hideTimer = null;
          message.textContent = 'A fresh pair. Have another go.';
        }, 1100);
      }
    }

    function beginRound(reshuffle, focusBoard) {
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      hideTimer = null;
      open = [];
      moves = pairs = 0;
      locked = false;
      running = true;
      consolePanel.classList.remove('is-complete');
      consolePanel.classList.add('is-playing');
      scoreMoves.textContent = '0';
      scorePairs.textContent = '0 / 6';
      start.innerHTML = 'Shuffle again <span aria-hidden="true">↻</span>';
      if (reshuffle) {
        shuffle();
        renderBoard();
      }
      message.textContent = 'Six happy pairs to find. Pick a bear.';
      if (focusBoard) board.children[0].focus({ preventScroll: true });
    }

    start.addEventListener('click', () => beginRound(true, true));
    board.addEventListener('click', event => {
      const button = event.target.closest('[data-token]');
      if (!button || !board.contains(button)) return;
      // A first tap starts the existing board, so there is no extra start-screen step.
      if (!running && pairs === 0) beginRound(false, false);
      flip(Number(button.dataset.token));
    });
    board.addEventListener('keydown', event => {
      const button = event.target.closest('[data-token]');
      if (!button || button.disabled) return;
      const index = Number(button.dataset.token);
      const columns = Math.max(1, getComputedStyle(board).gridTemplateColumns.split(/\s+/).filter(Boolean).length);
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
      let target;
      if (event.key in offsets) target = (index + offsets[event.key] + deck.length) % deck.length;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = deck.length - 1;
      else return;
      event.preventDefault();
      board.children[target].focus();
    });
    host.querySelector('#maker-help-button').addEventListener('click', event => {
      const button = event.currentTarget, help = host.querySelector('#maker-help');
      help.hidden = !help.hidden;
      button.setAttribute('aria-expanded', String(!help.hidden));
    });

    shuffle();
    renderBoard();
    window.addEventListener('pagehide', () => {
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
        open.forEach(index => { deck[index].revealed = false; updateToken(index); });
        open = [];
        locked = false;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountGame, { once: true });
  else mountGame();
})();

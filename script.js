'use strict';
// Pure rules engine: card piles are queues; won cards go to the bottom.
class WarGame {
  constructor(deck) {
    this.player = deck.slice(0, 26);
    this.computer = deck.slice(26);
    this.battle = [];
    this.war = false;
    this.ended = false;
    this.rounds = 0;
  }
  static deck() {
    return ['♠', '♥', '♦', '♣'].flatMap(suit =>
      Array.from({ length: 13 }, (_, i) => ({ id: `${suit}${i + 2}`, rank: i + 2, suit })));
  }
  static shuffledDeck() {
    const deck = WarGame.deck();
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
  checkCards() {
    const cards = [...this.player, ...this.computer, ...this.battle];
    if (cards.length !== 52 || new Set(cards.map(card => card.id)).size !== 52)
      throw new Error('Card conservation failed.');
  }
  award(winner) {
    this[winner].push(...this.battle);
    this.battle = [];
    this.war = false;
  }
  step() {
    if (this.ended) return null;
    const result = { playerCard: null, computerCard: null, playerDown: false, computerDown: false };
    if (!this.player.length || !this.computer.length) {
      this.ended = true;
      result.outcome = !this.player.length && !this.computer.length ? 'draw' : this.player.length ? 'player' : 'computer';
      if (result.outcome !== 'draw') this.award(result.outcome);
      this.checkCards();
      return { ...result, ended: true };
    }
    if (!this.war) this.rounds++;
    for (const side of ['player', 'computer']) {
      if (this.war && this[side].length > 1) {
        this.battle.push(this[side].shift());
        result[`${side}Down`] = true;
      }
      result[`${side}Card`] = this[side].shift();
      this.battle.push(result[`${side}Card`]);
    }
    // Counts include every card committed to this stage before settlement.
    result.battleSize = this.battle.length;
    result.playerRemaining = this.player.length;
    result.computerRemaining = this.computer.length;
    const difference = result.playerCard.rank - result.computerCard.rank;
    if (difference === 0) {
      this.war = true;
      result.outcome = 'war';
      if (!this.player.length || !this.computer.length) {
        this.ended = true;
        result.outcome = !this.player.length && !this.computer.length ? 'draw' : this.player.length ? 'player' : 'computer';
        if (result.outcome !== 'draw') this.award(result.outcome);
      }
    } else {
      result.outcome = difference > 0 ? 'player' : 'computer';
      this.award(result.outcome);
      this.ended = !this.player.length || !this.computer.length;
    }
    this.checkCards();
    return { ...result, ended: this.ended };
  }
}
if (typeof module !== 'undefined') module.exports = WarGame;
if (typeof document !== 'undefined') {
  const el = id => document.getElementById(id);
  let game = null;
  let busy = false;
  function counts() {
    el('player-count').textContent = game.player.length;
    el('computer-count').textContent = game.computer.length;
    el('battle-count').textContent = game.battle.length;
    el('round-count').textContent = game.rounds;
  }
  function showCard(side, card) {
    const slot = el(`${side}-card`);
    slot.replaceChildren();
    if (!card) return;
    const face = document.createElement('div');
    face.className = `playing-card${['♥', '♦'].includes(card.suit) ? ' red' : ''}`;
    const rank = ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' })[card.rank] || card.rank;
    face.setAttribute('aria-label', `${rank} ${card.suit}`);
    face.innerHTML = `<span class="corner">${rank}<small>${card.suit}</small></span><span class="suit">${card.suit}</span><span class="corner bottom">${rank}<small>${card.suit}</small></span>`;
    slot.append(face);
  }
  function start() {
    if (busy) return;
    game = new WarGame(WarGame.shuffledDeck());
    game.checkCards();
    counts();
    ['player', 'computer'].forEach(side => { showCard(side, null); el(`${side}-down`).textContent = ''; });
    el('message').textContent = 'The table is yours.';
    el('detail').textContent = 'Click Flip Cards to begin.';
    el('flip').textContent = 'Flip Cards ↗';
    el('flip').disabled = false;
    el('restart').disabled = false;
    el('start').hidden = true;
  }
  el('start').addEventListener('click', start);
  el('restart').addEventListener('click', start);
  el('flip').addEventListener('click', async () => {
    if (!game || game.ended || busy) return;
    busy = true;
    el('flip').disabled = el('restart').disabled = true;
    const wasWar = game.war;
    const result = game.step();
    ['player', 'computer'].forEach(side => {
      showCard(side, result[`${side}Card`]);
      el(`${side}-down`).textContent = result[`${side}Down`] ? '+1 face down' : '';
    });
    el('message').textContent = wasWar ? 'War cards revealed…' : 'Cards revealed…';
    el('detail').textContent = 'Comparing ranks…';
    el('battle-count').textContent = result.battleSize ?? game.battle.length;
    el('player-count').textContent = result.playerRemaining ?? game.player.length;
    el('computer-count').textContent = result.computerRemaining ?? game.computer.length;
    el('round-count').textContent = game.rounds;
    await new Promise(resolve => setTimeout(resolve, 650));
    counts();
    if (result.outcome === 'war') {
      el('message').textContent = 'WAR!';
      el('detail').textContent = 'One down, one up. Click to continue the battle.';
    } else if (result.outcome === 'draw') {
      el('message').textContent = 'It’s a draw!';
      el('detail').textContent = 'Both piles ran out. Unresolved cards remain in the battle.';
    } else {
      el(`${result.outcome}-card`).firstElementChild?.classList.add('winning');
      el('message').textContent = result.ended
        ? result.outcome === 'player' ? 'You win the game!' : 'Computer wins the game!'
        : result.outcome === 'player' ? 'You win this round' : 'Computer wins this round';
      el('detail').textContent = result.ended ? 'All 52 cards collected. Play again?' : `${result.battleSize} cards added to the bottom of the winning pile.`;
    }
    busy = false;
    el('restart').disabled = false;
    el('flip').disabled = game.ended;
    el('flip').textContent = game.war && !game.ended ? 'Continue War ↗' : 'Flip Cards ↗';
  });
  el('help').addEventListener('click', () => el('rules').showModal());
  el('close-rules').addEventListener('click', () => el('rules').close());
}

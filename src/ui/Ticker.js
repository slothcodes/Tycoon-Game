import { EventBus } from '../core/EventBus.js';
import { GameState } from '../core/GameState.js';
import { formatCurrency, formatPercent } from '../utils/math.js';

export const Ticker = {
  element: null,
  newsList: null,
  previousInterestRate: null,

  init() {
    this.element = document.getElementById('ticker');
    this.newsList = document.getElementById('news-list');

    // Initialize previous rate
    if (GameState.market.macro && GameState.market.macro.interestRate !== undefined) {
      this.previousInterestRate = GameState.market.macro.interestRate;
    }

    EventBus.on('MARKET_UPDATED', () => {
      this.updateTicker();
      this.checkMacroNews();
    });
    EventBus.on('NEWS_ALERT', (msg) => this.addNews(msg));
    EventBus.on('TRADE_SUCCESS', (msg) => this.addNews(`[TRADE] ${msg}`));

    this.updateTicker();
  },

  updateTicker() {
    if (!this.element) return;

    const tickerItems = GameState.companies.map(c => {
      const history = c.priceHistory;
      const prevPrice = history.length > 1 ? history[history.length - 2] : history[0];
      const diff = c.price - prevPrice;
      const icon = diff >= 0 ? '▲' : '▼';
      const colorClass = diff >= 0 ? 'color: var(--positive-color)' : 'color: var(--negative-color)';

      return `<span class="ticker-item" style="${colorClass}">${c.name} ${formatCurrency(c.price)} ${icon}</span>`;
    }).join(' | ');

    this.element.innerHTML = tickerItems;
  },

  checkMacroNews() {
    const currentRate = GameState.market?.macro?.interestRate;
    if (currentRate === undefined) return;

    if (this.previousInterestRate !== null && currentRate !== this.previousInterestRate) {
      const action = currentRate > this.previousInterestRate ? "RAISES" : "CUTS";
      // To avoid spamming, only alert on significant changes like intervals of 0.25%, but since we tick by 0.0025,
      // let's alert whenever it actually changes.
      this.addNews(`FED ${action} RATES TO ${formatPercent(currentRate)}`);
      this.previousInterestRate = currentRate;
    }
  },

  addNews(msg) {
    if (!this.newsList) return;

    const li = document.createElement('li');
    li.className = 'news-item';
    li.textContent = `[Day ${GameState.market.day}] ${msg}`;

    this.newsList.prepend(li);

    // Cap news history
    if (this.newsList.children.length > 50) {
      this.newsList.removeChild(this.newsList.lastChild);
    }
  }
};

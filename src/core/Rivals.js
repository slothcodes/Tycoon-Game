import { GameState } from './GameState.js';
import { EventBus } from './EventBus.js';
import { GAME_CONFIG } from '../utils/config.js';

export const Rivals = {
  tick() {
    // Only run rival AI every 5 ticks to save performance and simulate "strategy sessions"
    if (GameState.market.day % 5 !== 0) return;

    if (!GameState.rivals) return; // For old saves

    GameState.rivals.forEach(rival => {
      // Rivals get regular cash infusions (AUM growth)
      rival.cash += 500000;

      // Find an undervalued company
      // Filter out bankrupt ones, and those already controlled by someone else
      let availableTargets = GameState.companies.filter(c => !c.isBankrupt && !c.isPlayerControlled && !this.isControlledByRival(c));

      if (availableTargets.length === 0) return;

      // Sort by a rudimentary "Value" metric: Low PE, High EPS, High Cash
      availableTargets.sort((a, b) => {
        const valA = (a.eps / a.price) + (a.cashOnHand / a.revenue);
        const valB = (b.eps / b.price) + (b.cashOnHand / b.revenue);
        return valB - valA; // Descending
      });

      const target = availableTargets[0];

      // Attempt to buy 1-3% of outstanding shares
      const targetPercent = (Math.random() * 0.02) + 0.01;
      let sharesToBuy = Math.floor(target.sharesOutstanding * targetPercent);

      // Ensure they don't buy more than public float (for simplicity, we won't strictly enforce float yet, just price)
      const estimatedCost = sharesToBuy * target.price * (1 + GAME_CONFIG.slippageFactor * targetPercent);

      if (rival.cash > estimatedCost) {
        rival.cash -= estimatedCost;

        if (!rival.portfolio[target.id]) {
          rival.portfolio[target.id] = { shares: 0 };
        }

        const oldShares = rival.portfolio[target.id].shares;
        rival.portfolio[target.id].shares += sharesToBuy;
        const newShares = rival.portfolio[target.id].shares;

        // Check ownership thresholds for news alerts
        const oldPercent = oldShares / target.sharesOutstanding;
        const newPercent = newShares / target.sharesOutstanding;

        if (oldPercent < GAME_CONFIG.ownershipNewsThreshold && newPercent >= GAME_CONFIG.ownershipNewsThreshold) {
          EventBus.emit('NEWS_ALERT', `MARKET MOVER: ${rival.name} acquired a >5% stake in ${target.name}.`);
        }

        if (newPercent > GAME_CONFIG.monopolyThreshold && oldPercent <= GAME_CONFIG.monopolyThreshold) {
           EventBus.emit('NEWS_ALERT', `TAKEOVER: ${rival.name} has gained a controlling interest (>51%) in ${target.name}!`);
        }
      }
    });
  },

  isControlledByRival(company) {
    for (const rival of GameState.rivals) {
      if (rival.portfolio[company.id]) {
        if ((rival.portfolio[company.id].shares / company.sharesOutstanding) > GAME_CONFIG.monopolyThreshold) {
          return true;
        }
      }
    }
    return false;
  }
};
